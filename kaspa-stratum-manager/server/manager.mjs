import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  atomicWrite, parseBridgeSettings, readSettingsFile, sanitizedSettingsModel, updateBridgeYaml, validateSettings,
} from "./settings.mjs";
import { MiningHistoryStore, SEVEN_DAYS_MS } from "./history.mjs";

const json = (res, status, body, origin = "") => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(origin ? { "access-control-allow-origin": origin } : {}),
  });
  res.end(JSON.stringify(body));
};

const parseEndpoint = (value, defaultPort) => {
  const input = String(value || "").trim().replace(/^https?:\/\//, "");
  const split = input.lastIndexOf(":");
  if (split < 1) return { host: input || "127.0.0.1", port: defaultPort };
  return { host: input.slice(0, split), port: Number(input.slice(split + 1)) || defaultPort };
};

const tcpProbe = ({ host, port }, timeoutMs) =>
  new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host, port });
    const finish = (reachable, error = null) => {
      socket.destroy();
      resolve({ reachable, latency_ms: Date.now() - started, error });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (error) => finish(false, error.code || error.message));
  });

const fetchJson = async (url, timeoutMs) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

const readJsonBody = (req, limit = 16_384) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > limit) {
      reject(Object.assign(new Error("Settings request is too large"), { statusCode: 413 }));
      req.destroy();
    } else chunks.push(chunk);
  });
  req.on("end", () => {
    try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null")); }
    catch { reject(Object.assign(new Error("Settings must be valid JSON"), { statusCode: 400 })); }
  });
  req.on("error", reject);
});

const serialQueue = () => {
  let tail = Promise.resolve();
  return (operation) => {
    const result = tail.then(operation, operation);
    tail = result.catch(() => {});
    return result;
  };
};

class RingLog {
  constructor(limit = 500) { this.limit = limit; this.lines = []; }
  add(source, line) {
    for (const value of String(line).split(/\r?\n/).filter(Boolean)) {
      this.lines.push({ timestamp: new Date().toISOString(), source, line: value });
      if (this.lines.length > this.limit) this.lines.shift();
    }
  }
  list(limit = 200) { return this.lines.slice(-Math.min(Math.max(limit, 1), this.limit)); }
}

export class BridgeSupervisor {
  constructor(config, logs = new RingLog()) {
    this.config = config;
    this.logs = logs;
    this.child = null;
    this.startedAt = null;
    this.lastExit = null;
    this.intentionalStop = false;
  }
  get managed() { return Boolean(this.config.bridgeCommand); }
  state() {
    return {
      managed: this.managed,
      state: this.child ? "running" : "stopped",
      pid: this.child?.pid ?? null,
      started_at: this.startedAt,
      uptime_seconds: this.startedAt ? Math.floor((Date.now() - Date.parse(this.startedAt)) / 1000) : 0,
      last_exit: this.lastExit,
    };
  }
  async start() {
    if (!this.managed) throw Object.assign(new Error("Bridge supervision is disabled in this profile"), { statusCode: 409 });
    if (this.child) return this.state();
    this.intentionalStop = false;
    const child = spawn(this.config.bridgeCommand, this.config.bridgeArgs, {
      cwd: this.config.bridgeWorkingDirectory || process.cwd(),
      env: { ...process.env, ...this.config.bridgeEnv },
      shell: process.platform === "win32",
      windowsHide: true,
    });
    this.child = child;
    this.startedAt = new Date().toISOString();
    this.logs.add("manager", `Started bridge process ${child.pid}`);
    child.stdout?.on("data", (data) => this.logs.add("bridge", data));
    child.stderr?.on("data", (data) => this.logs.add("bridge", data));
    child.once("error", (error) => this.logs.add("manager", `Bridge error: ${error.message}`));
    child.once("exit", (code, signal) => {
      this.lastExit = { code, signal, timestamp: new Date().toISOString(), intentional: this.intentionalStop };
      this.logs.add("manager", `Bridge exited (code=${code}, signal=${signal})`);
      this.child = null;
      this.startedAt = null;
    });
    return this.state();
  }
  async stop() {
    if (!this.child) return this.state();
    this.intentionalStop = true;
    const child = this.child;
    await new Promise((resolve) => {
      const timer = setTimeout(() => { if (this.child === child) child.kill("SIGKILL"); }, this.config.stopTimeoutMs);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
      child.kill("SIGTERM");
    });
    return this.state();
  }
  async restart() { await this.stop(); return this.start(); }
}

export const loadConfig = (env = process.env) => {
  const bridgeArgs = env.BRIDGE_ARGS_JSON ? JSON.parse(env.BRIDGE_ARGS_JSON) : [];
  if (!Array.isArray(bridgeArgs) || bridgeArgs.some((arg) => typeof arg !== "string")) throw new Error("BRIDGE_ARGS_JSON must be a JSON string array");
  return {
    listenHost: env.MANAGER_HOST || "0.0.0.0",
    listenPort: Number(env.MANAGER_PORT || 8081),
    appVersion: env.APP_VERSION || "development",
    bridgeVersion: env.BRIDGE_VERSION || "unknown",
    profile: env.APP_PROFILE || "windows-development",
    nodeEndpoint: parseEndpoint(env.KASPA_NODE_GRPC || "127.0.0.1:16110", 16110),
    stratumEndpoint: parseEndpoint(env.STRATUM_ENDPOINT || "127.0.0.1:5555", 5555),
    bridgeApiUrl: (env.BRIDGE_API_URL || "http://127.0.0.1:3030").replace(/\/$/, ""),
    bridgeCommand: env.BRIDGE_COMMAND || "",
    bridgeArgs,
    bridgeWorkingDirectory: env.BRIDGE_WORKING_DIRECTORY || "",
    bridgeEnv: { RKSTRATUM_ALLOW_CONFIG_WRITE: env.RKSTRATUM_ALLOW_CONFIG_WRITE || "0" },
    probeTimeoutMs: Number(env.PROBE_TIMEOUT_MS || 2500),
    stopTimeoutMs: Number(env.BRIDGE_STOP_TIMEOUT_MS || 10000),
    settingsPath: env.BRIDGE_CONFIG_PATH || `${env.DATA_DIR || "/data"}/config.yaml`,
    settingsBackupPath: env.BRIDGE_CONFIG_BACKUP_PATH || `${env.DATA_DIR || "/data"}/config.last-good.yaml`,
    settingsHealthTimeoutMs: Number(env.SETTINGS_HEALTH_TIMEOUT_MS || 15000),
    settingsHealthIntervalMs: Number(env.SETTINGS_HEALTH_INTERVAL_MS || 500),
    historyPath: env.MINING_HISTORY_PATH || `${env.DATA_DIR || "/data"}/mining-history.json`,
    historyRetentionMs: Number(env.HISTORY_RETENTION_MS || SEVEN_DAYS_MS),
    historySampleIntervalMs: Number(env.HISTORY_SAMPLE_INTERVAL_MS || 60000),
    historyFlushIntervalMs: Number(env.HISTORY_FLUSH_INTERVAL_MS || 300000),
    allowedOrigin: env.DEV_ALLOWED_ORIGIN || "http://localhost:3000",
  };
};

export const createManager = (config = loadConfig(), dependencies = {}) => {
  const logs = new RingLog();
  const supervisor = dependencies.supervisor || new BridgeSupervisor(config, logs);
  const fetchBridgeStats = dependencies.fetchBridgeStats || (() => fetchJson(`${config.bridgeApiUrl}/api/stats`, config.probeTimeoutMs));
  const history = dependencies.historyStore || new MiningHistoryStore({
    path: config.historyPath,
    retentionMs: config.historyRetentionMs,
    sampleIntervalMs: config.historySampleIntervalMs,
    flushIntervalMs: config.historyFlushIntervalMs,
    onError: (message) => logs.add("manager", message),
  });
  let historyTimer = null;
  let historySample = null;
  const serializeSettingsWrite = serialQueue();
  const waitForBridgeHealthy = dependencies.waitForBridgeHealthy || (async () => {
    const deadline = Date.now() + config.settingsHealthTimeoutMs;
    let lastError = "Bridge did not become healthy";
    do {
      try {
        await fetchJson(`${config.bridgeApiUrl}/api/status`, Math.min(config.probeTimeoutMs, Math.max(1, deadline - Date.now())));
        return true;
      } catch (error) { lastError = error.message; }
      await new Promise((resolve) => setTimeout(resolve, Math.min(config.settingsHealthIntervalMs, Math.max(0, deadline - Date.now()))));
    } while (Date.now() < deadline);
    throw new Error(lastError);
  });

  const saveSettings = (input) => serializeSettingsWrite(async () => {
    const validation = validateSettings(input);
    if (validation.issues) throw Object.assign(new Error("Settings validation failed"), { statusCode: 400, issues: validation.issues });
    if (!supervisor.managed) throw Object.assign(new Error("Settings can only be saved in the managed Umbrel profile"), { statusCode: 409 });
    const previous = await readFile(config.settingsPath, "utf8");
    const updated = updateBridgeYaml(previous, validation.value);
    await atomicWrite(config.settingsBackupPath, previous);
    await atomicWrite(config.settingsPath, updated);
    try {
      await supervisor.restart();
      await waitForBridgeHealthy();
      return { result: "saved", settings: parseBridgeSettingsForResponse(updated), bridgeRestarted: true };
    } catch (error) {
      logs.add("manager", `Settings failed health check; restoring last-known-good configuration: ${error.message}`);
      let restartError = null;
      await atomicWrite(config.settingsPath, previous);
      try { await supervisor.restart(); await waitForBridgeHealthy(); }
      catch (rollbackError) { restartError = rollbackError.message; }
      throw Object.assign(new Error("New settings failed; the last-known-good configuration was restored"), {
        statusCode: 503,
        result: "rolled_back",
        rollback: { restored: true, restarted: restartError === null, healthy: restartError === null, error: restartError },
      });
    }
  });

  const parseBridgeSettingsForResponse = (source) => sanitizedSettingsModel(
    // Re-read through the same parser used by GET without exposing raw YAML.
    parseBridgeSettings(source),
  ).settings;

  const sampleHistory = async () => {
    try { await history.record(await fetchBridgeStats()); }
    catch (error) { logs.add("manager", `Mining history sample skipped: ${error.message}`); }
  };
  const startHistory = async () => {
    if (historyTimer) return;
    historySample = sampleHistory();
    await historySample;
    historyTimer = setInterval(() => { historySample = sampleHistory(); }, config.historySampleIntervalMs);
    historyTimer.unref?.();
  };
  const stopHistory = async () => {
    if (historyTimer) clearInterval(historyTimer);
    historyTimer = null;
    await historySample?.catch(() => {});
    await history.close().catch((error) => logs.add("manager", `Mining history could not be saved: ${error.message}`));
  };

  const handler = async (req, res) => {
    const origin = req.headers.origin === config.allowedOrigin ? config.allowedOrigin : "";
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...(origin ? { "access-control-allow-origin": origin } : {}),
        "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      return res.end();
    }
    const url = new URL(req.url, "http://manager.local");
    try {
      if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/api/manager/status")) {
        const [node, stratum] = await Promise.all([
          tcpProbe(config.nodeEndpoint, config.probeTimeoutMs),
          tcpProbe(config.stratumEndpoint || { host: "127.0.0.1", port: 5555 }, config.probeTimeoutMs),
        ]);
        let bridgeApi = { reachable: false, error: null, status: null };
        try {
          bridgeApi = { reachable: true, error: null, status: await fetchJson(`${config.bridgeApiUrl}/api/status`, config.probeTimeoutMs) };
        } catch (error) { bridgeApi.error = error.cause?.code || error.message; }
        const body = {
          healthy: node.reachable && (bridgeApi.reachable || !supervisor.managed),
          appVersion: config.appVersion || "development",
          bridgeVersion: config.bridgeVersion || "unknown",
          profile: config.profile,
          node: { endpoint: `${config.nodeEndpoint.host}:${config.nodeEndpoint.port}`, ...node },
          stratum: { port: config.stratumEndpoint?.port || 5555, ...stratum },
          bridge: { ...supervisor.state(), api_url: config.bridgeApiUrl, api: bridgeApi },
          checked_at: new Date().toISOString(),
        };
        return json(res, url.pathname === "/healthz" && !body.healthy ? 503 : 200, body, origin);
      }
      if (req.method === "GET" && url.pathname === "/api/manager/stats") {
        return json(res, 200, await fetchBridgeStats(), origin);
      }
      if (req.method === "GET" && url.pathname === "/api/manager/history") {
        return json(res, 200, await history.summary(), origin);
      }
      if (req.method === "GET" && url.pathname === "/api/manager/logs") {
        return json(res, 200, { lines: logs.list(Number(url.searchParams.get("limit") || 200)) }, origin);
      }
      if (req.method === "GET" && url.pathname === "/api/manager/settings") {
        return json(res, 200, sanitizedSettingsModel(await readSettingsFile(config.settingsPath)), origin);
      }
      if (req.method === "PUT" && url.pathname === "/api/manager/settings") {
        return json(res, 200, await saveSettings(await readJsonBody(req)), origin);
      }
      const action = url.pathname.match(/^\/api\/manager\/bridge\/(start|stop|restart)$/)?.[1];
      if (req.method === "POST" && action) return json(res, 200, await supervisor[action](), origin);
      return json(res, 404, { error: "not_found" }, origin);
    } catch (error) {
      logs.add("manager", error.stack || error.message);
      return json(res, error.statusCode || 502, {
        error: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
        ...(error.result ? { result: error.result, rollback: error.rollback } : {}),
      }, origin);
    }
  };

  return {
    config, logs, supervisor, history, sampleHistory, startHistory, stopHistory,
    server: http.createServer(handler),
    async close() { await stopHistory(); await supervisor.stop(); },
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const manager = createManager();
  manager.server.listen(manager.config.listenPort, manager.config.listenHost, async () => {
    manager.logs.add("manager", `Listening on ${manager.config.listenHost}:${manager.config.listenPort} (${manager.config.profile})`);
    if (manager.supervisor.managed) {
      try { await manager.supervisor.start(); } catch (error) { manager.logs.add("manager", error.message); }
    }
    await manager.startHistory();
  });
  const shutdown = async () => { await manager.close(); manager.server.close(() => process.exit(0)); };
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
}

