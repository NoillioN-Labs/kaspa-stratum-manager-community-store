import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import process from "node:process";
import { pathToFileURL } from "node:url";

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
    profile: env.APP_PROFILE || "windows-development",
    nodeEndpoint: parseEndpoint(env.KASPA_NODE_GRPC || "umbrel.local:16110", 16110),
    bridgeApiUrl: (env.BRIDGE_API_URL || "http://127.0.0.1:3030").replace(/\/$/, ""),
    bridgeCommand: env.BRIDGE_COMMAND || "",
    bridgeArgs,
    bridgeWorkingDirectory: env.BRIDGE_WORKING_DIRECTORY || "",
    bridgeEnv: { RKSTRATUM_ALLOW_CONFIG_WRITE: env.RKSTRATUM_ALLOW_CONFIG_WRITE || "0" },
    probeTimeoutMs: Number(env.PROBE_TIMEOUT_MS || 2500),
    stopTimeoutMs: Number(env.BRIDGE_STOP_TIMEOUT_MS || 10000),
    allowedOrigin: env.DEV_ALLOWED_ORIGIN || "http://localhost:3000",
  };
};

export const createManager = (config = loadConfig()) => {
  const logs = new RingLog();
  const supervisor = new BridgeSupervisor(config, logs);

  const handler = async (req, res) => {
    const origin = req.headers.origin === config.allowedOrigin ? config.allowedOrigin : "";
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...(origin ? { "access-control-allow-origin": origin } : {}),
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      return res.end();
    }
    const url = new URL(req.url, "http://manager.local");
    try {
      if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/api/manager/status")) {
        const node = await tcpProbe(config.nodeEndpoint, config.probeTimeoutMs);
        let bridgeApi = { reachable: false, error: null, status: null };
        try {
          bridgeApi = { reachable: true, error: null, status: await fetchJson(`${config.bridgeApiUrl}/api/status`, config.probeTimeoutMs) };
        } catch (error) { bridgeApi.error = error.cause?.code || error.message; }
        const body = {
          healthy: node.reachable && (bridgeApi.reachable || !supervisor.managed),
          profile: config.profile,
          node: { endpoint: `${config.nodeEndpoint.host}:${config.nodeEndpoint.port}`, ...node },
          bridge: { ...supervisor.state(), api_url: config.bridgeApiUrl, api: bridgeApi },
          checked_at: new Date().toISOString(),
        };
        return json(res, url.pathname === "/healthz" && !body.healthy ? 503 : 200, body, origin);
      }
      if (req.method === "GET" && url.pathname === "/api/manager/stats") {
        return json(res, 200, await fetchJson(`${config.bridgeApiUrl}/api/stats`, config.probeTimeoutMs), origin);
      }
      if (req.method === "GET" && url.pathname === "/api/manager/logs") {
        return json(res, 200, { lines: logs.list(Number(url.searchParams.get("limit") || 200)) }, origin);
      }
      const action = url.pathname.match(/^\/api\/manager\/bridge\/(start|stop|restart)$/)?.[1];
      if (req.method === "POST" && action) return json(res, 200, await supervisor[action](), origin);
      return json(res, 404, { error: "not_found" }, origin);
    } catch (error) {
      logs.add("manager", error.stack || error.message);
      return json(res, error.statusCode || 502, { error: error.message }, origin);
    }
  };

  return {
    config, logs, supervisor,
    server: http.createServer(handler),
    async close() { await supervisor.stop(); },
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
  });
  const shutdown = async () => { await manager.close(); manager.server.close(() => process.exit(0)); };
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
}
