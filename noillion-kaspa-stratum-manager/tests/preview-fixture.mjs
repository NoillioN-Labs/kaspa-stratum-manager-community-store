// Explicitly simulated, loopback-only interface test. Never packaged as a service.
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { createManager, loadConfig } from "../server/manager.mjs";
import { AUTOMATIC_SETTINGS, updateBridgeYaml } from "../server/settings.mjs";
const directory = await mkdtemp(path.join(os.tmpdir(), "ksm-preview-fixture-"));
const now = Date.now(),
  workers = [
    {
      worker: "KS7-Lite",
      hashrateGhs: 4200,
      acceptedShares: 48600,
      status: "online",
    },
    {
      worker: "KS0-Ultra",
      hashrateGhs: 400,
      acceptedShares: 5900,
      status: "online",
    },
  ];
const bridge = http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ kaspad_version: "2.0.1", isSynced: true }));
});
await new Promise((resolve) => bridge.listen(0, "127.0.0.1", resolve));
const config = loadConfig({
  DATA_DIR: directory,
  APP_PROFILE: "test-fixture",
  APP_VERSION: "development",
  KASPA_REWARD_ANALYTICS_ENABLED: "false",
  KASPA_NODE_GRPC: `127.0.0.1:${bridge.address().port}`,
  STRATUM_ENDPOINT: `127.0.0.1:${bridge.address().port}`,
  BRIDGE_API_URL: `http://127.0.0.1:${bridge.address().port}`,
});
await writeFile(
  config.settingsPath,
  updateBridgeYaml(
    await readFile(new URL("../config/bridge.yaml", import.meta.url), "utf8"),
    AUTOMATIC_SETTINGS,
  ),
);
let state = "running";
const supervisor = {
  managed: true,
  state: () => ({ managed: true, state, uptime_seconds: 38400 }),
  start: async () => {
    state = "running";
    return supervisor.state();
  },
  stop: async () => {
    state = "stopped";
    return supervisor.state();
  },
  restart: async () => {
    state = "running";
    return supervisor.state();
  },
};
const stats = {
  workers,
  activeWorkers: 2,
  totalShares: 54500,
  networkHashrate: 1e18,
  networkDifficulty: 1e15,
  networkBlockCount: 1e8,
  blocks: [],
};
const manager = createManager(config, {
  supervisor,
  fetchBridgeStats: async () => stats,
  waitForBridgeHealthy: async () => true,
});
for (let i = 0; i < 120; i++)
  await manager.metrics.record(
    {
      ...stats,
      workers: workers.map((w) => ({
        ...w,
        hashrateGhs: w.hashrateGhs * (0.95 + 0.1 * Math.sin(i)),
      })),
    },
    now - (120 - i) * 5000,
  );
for (let i = 0; i < 120; i++)
  await manager.history.record(
    {
      ...stats,
      networkBlockCount: 1e8 + i * 600,
      workers: workers.map((w) => ({ ...w, acceptedShares: i * 100 })),
    },
    now - (120 - i) * 60000,
  );
await manager.history.record(
  {
    ...stats,
    blocks: Array.from({ length: 65 }, (_, i) => ({
      worker: workers[i % 2].worker,
      hash: i.toString(16).padStart(64, "0"),
      timestamp: (now - (65 - i) * 3600000) / 1000,
    })),
  },
  now,
);
for (let i = 0; i < 65; i++) {
  const status = i % 13 === 0 ? "red" : i > 61 ? "unknown" : "blue";
  await manager.history.updateBlockReward(i.toString(16).padStart(64, "0"), {
    rewardStatus: status,
    blockColor: status,
    confirmationCount: "150",
    totalRewardSompi: status === "blue" ? "3250000000" : null,
    subsidySompi: "3000000000",
    acceptedTxFeesSompi: "150000000",
    dagMergeRewardSompi: "100000000",
    rewardDecompositionVerified: status === "blue",
    rewardLastCheckedAt: now,
  });
}
manager.nodeMonitor.connected = true;
manager.nodeMonitor.checkedAt = new Date().toISOString();
manager.nodeMonitor.info = {
  serverVersion: "2.0.1",
  networkId: "mainnet",
  isSynced: true,
  virtualDaaScore: "287654312",
  blockCount: "286540009",
  headerCount: "286540009",
  difficulty: 1e15,
  peerCount: 12,
  tipCount: 4,
};
for (let i = 0; i < 60; i++) {
  const hash = i.toString(16).padStart(64, "0");
  manager.nodeMonitor.add({
    header: {
      daaScore: String(Math.floor(i / 3)),
      blueScore: String(i),
      parents: [
        { parentHashes: i > 3 ? [(i - 3).toString(16).padStart(64, "0")] : [] },
      ],
    },
    verboseData: {
      hash,
      isChainBlock: i % 3 === 0,
      mergeSetBluesHashes:
        i > 1 ? [(i - 1).toString(16).padStart(64, "0")] : [],
    },
  });
}
manager.logs.add(
  "manager",
  "Simulated preview started — no hardware connection",
);
await new Promise((resolve) =>
  manager.server.listen(8081, "127.0.0.1", resolve),
);
console.log("SIMULATED fixture API listening on http://127.0.0.1:8081");
const close = async () => {
  await manager.close();
  manager.server.close();
  bridge.close();
  await rm(directory, { recursive: true, force: true });
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);

