import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { MiningHistoryStore } from "./history.mjs";
import { DashboardMetricsStore } from "./metrics.mjs";
import { BridgeSupervisor } from "./manager.mjs";
import { decomposeBlockReward } from "./rewards.mjs";
import { NodeMonitor } from "./node-monitor.mjs";
import { EventEmitter } from "node:events";
async function setup(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ksm-regression-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let now = Date.now();
  return {
    file: path.join(dir, "history.json"),
    now: () => now,
    advance: (ms) => (now += ms),
  };
}
test("reset preserves durable rewards and deduplicates repeated bridge reports", async (t) => {
  const c = await setup(t),
    h = new MiningHistoryStore({ path: c.file, now: c.now }),
    stats = { workers: [], blocks: [{ hash: "a", worker: "rig" }] };
  await h.record(stats);
  await h.updateBlockReward("a", {
    rewardStatus: "blue",
    blockColor: "blue",
    totalRewardSompi: "42",
  });
  await h.reset();
  await h.record(stats);
  await h.close();
  const restored = new MiningHistoryStore({ path: c.file, now: c.now });
  assert.equal((await restored.rewardSummary()).totalRewardSompi, "42");
  assert.equal((await restored.rewardBlocks()).length, 1);
});
test("failing lookups cannot starve new discoveries; resolved blocks are rechecked", async (t) => {
  const c = await setup(t),
    h = new MiningHistoryStore({ path: c.file, now: c.now });
  await h.record({
    blocks: Array.from({ length: 5 }, (_, i) => ({
      hash: String(i),
      worker: "rig",
    })),
  });
  for (const b of await h.unresolvedRewardBlocks(4))
    await h.updateBlockReward(b.hash, {
      rewardStatus: "error",
      rewardLastCheckedAt: c.now(),
    });
  assert.deepEqual(
    (await h.unresolvedRewardBlocks(4)).map((b) => b.hash),
    ["4"],
  );
  await h.updateBlockReward("4", {
    rewardStatus: "blue",
    blockColor: "blue",
    totalRewardSompi: "10",
    rewardLastCheckedAt: c.now(),
  });
  c.advance(300001);
  assert.ok((await h.unresolvedRewardBlocks(100)).some((b) => b.hash === "4"));
});
test("error states and invalid component sums cannot inflate realised totals", async (t) => {
  const c = await setup(t),
    h = new MiningHistoryStore({ path: c.file, now: c.now });
  await h.record({
    blocks: [
      { hash: "a", worker: "rig" },
      { hash: "b", worker: "rig" },
    ],
  });
  await h.updateBlockReward("a", {
    rewardStatus: "error",
    totalRewardSompi: "123",
  });
  await h.updateBlockReward("b", {
    rewardStatus: "blue",
    blockColor: "blue",
    totalRewardSompi: "10",
    rewardDecompositionVerified: true,
    subsidySompi: "20",
    acceptedTxFeesSompi: "0",
    dagMergeRewardSompi: "0",
  });
  const s = await h.rewardSummary();
  assert.equal(s.totalRewardSompi, "10");
  assert.equal(s.subsidySompi, "0");
  assert.equal(
    s.daily.reduce((a, b) => a + BigInt(b.totalRewardSompi), 0n),
    10n,
  );
});
test("all 501 discoveries contribute to charts and stable ledger pages; lifetime exceeds one year", async (t) => {
  const c = await setup(t),
    blocks = Array.from({ length: 501 }, (_, i) => ({
      hash: i.toString(16).padStart(64, "0"),
      worker: "rig",
      timestamp: c.now() - i * 60000,
      rewardStatus: "blue",
      blockColor: "blue",
      totalRewardSompi: "9007199254740993",
    }));
  await writeFile(c.file, JSON.stringify({ version: 3, samples: [], blocks }));
  const h = new MiningHistoryStore({ path: c.file, now: c.now });
  const s = await h.rewardSummary();
  assert.equal(BigInt(s.totalRewardSompi), 501n * 9007199254740993n);
  assert.equal(
    s.daily.reduce((a, b) => a + BigInt(b.totalRewardSompi), 0n),
    BigInt(s.totalRewardSompi),
  );
  assert.ok(s.daily.length <= 122);
  const hashes = [];
  let cursor = "";
  do {
    const page = await h.ledger({ cursor, limit: 50 });
    hashes.push(...page.blocks.map((b) => b.hash));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(new Set(hashes).size, 501);
  c.advance(366 * 86400000);
  assert.equal((await h.rewardSummary()).blocksFound, 501);
});
test("corrupt and future-schema files stay byte-for-byte untouched", async (t) => {
  const c = await setup(t);
  for (const input of [
    "{invalid",
    JSON.stringify({ version: 999, samples: [], blocks: [] }),
  ]) {
    await writeFile(c.file, input);
    const h = new MiningHistoryStore({ path: c.file });
    await assert.rejects(() => h.record({}));
    assert.equal(await readFile(c.file, "utf8"), input);
  }
});
test("missing counters stay unavailable and miner count falls back to workers", async (t) => {
  const c = await setup(t),
    m = new DashboardMetricsStore({ path: c.file, now: c.now });
  await m.record({
    activeWorkers: null,
    totalShares: 10,
    workers: [{ hashrate: 1 }],
  });
  c.advance(5000);
  await m.record({ totalShares: null, workers: [{ hashrate: 1 }] });
  c.advance(5000);
  await m.record({ totalShares: 11, workers: [{ hashrate: 1 }] });
  const s = await m.summary();
  assert.equal(s.acceptedSharesTotal, 11);
  assert.equal(s.samples.at(-1).connectedMiners, 1);
});
test("concurrent restarts leave one child; stop cancels recovery", async (t) => {
  const supervisor = new BridgeSupervisor({
    bridgeCommand: process.execPath,
    bridgeArgs: ["-e", "setInterval(()=>{},1000)"],
    stopTimeoutMs: 1000,
  });
  t.after(() => supervisor.stop());
  await supervisor.start();
  await Promise.all([supervisor.restart(), supervisor.restart()]);
  assert.equal(supervisor.state().state, "running");
  assert.ok(supervisor.state().pid);
  await supervisor.stop();
  assert.equal(supervisor.state().state, "stopped");
  assert.equal(supervisor.restartTimer, null);
});
test("failed spawn never reports running and can be stopped", async () => {
  const supervisor = new BridgeSupervisor({
    bridgeCommand: "ksm-nonexistent-binary-4837",
    bridgeArgs: [],
    stopTimeoutMs: 100,
  });
  await assert.rejects(() => supervisor.start());
  await supervisor.stop();
  assert.equal(supervisor.state().state, "stopped");
});
test("GhostDAG stays bounded and marks subscription loss", () => {
  const rpc = new EventEmitter(),
    monitor = new NodeMonitor(rpc);
  for (let i = 0; i < 200; i++)
    rpc.emit("block", {
      header: { daaScore: String(i), parents: [] },
      verboseData: { hash: i.toString(16).padStart(64, "0") },
    });
  assert.equal(monitor.snapshot().blocks.length, 160);
  rpc.emit("offline");
  assert.equal(monitor.snapshot().connected, false);
  assert.equal(monitor.subscribed, false);
});
test("incomplete merge mapping cannot be verified", () => {
  const hash = "a".repeat(64),
    mergingHash = "b".repeat(64),
    payload = Buffer.alloc(20);
  payload[18] = 1;
  payload[19] = 0x51;
  payload.writeBigUInt64LE(10n, 8);
  assert.throws(
    () =>
      decomposeBlockReward({
        hash,
        mergingHash,
        totalRewardSompi: "15",
        queriedBlock: {
          verboseData: { hash },
          transactions: [{ payload: payload.toString("hex") }],
        },
        mergingBlock: {
          verboseData: {
            hash: mergingHash,
            mergeSetBluesHashes: [hash, "c".repeat(64)],
          },
          transactions: [
            {
              outputs: [
                {
                  amount: "15",
                  scriptPublicKey: { version: 0, scriptPublicKey: "51" },
                },
              ],
            },
          ],
        },
      }),
    /ambiguous/,
  );
});

test("backup recovery validates before replacement and preserves originals", async (t) => {
  const { restoreBackup } = await import("../scripts/restore-backup.mjs");
  const { AUTOMATIC_SETTINGS, atomicWrite } = await import("./settings.mjs");
  const c = await setup(t),
    directory = path.dirname(c.file),
    h = new MiningHistoryStore({ path: c.file, now: c.now });
  await h.record({ blocks: [{ hash: "saved", worker: "rig" }] });
  const m = new DashboardMetricsStore({
    path: path.join(directory, "metrics-source.json"),
    now: c.now,
  });
  await m.record({ totalShares: 25, workers: [] });
  const backup = {
    format: "kaspa-stratum-manager-backup",
    version: 1,
    history: await h.exportData(),
    metrics: await m.exportData(),
    settings: AUTOMATIC_SETTINGS,
  };
  const backupFile = path.join(directory, "backup.json");
  await writeFile(backupFile, JSON.stringify(backup));
  await writeFile(
    path.join(directory, "config.yaml"),
    await readFile(new URL("../config/bridge.yaml", import.meta.url), "utf8"),
  );
  await writeFile(path.join(directory, "mining-history.json"), "original");
  const result = await restoreBackup(backupFile, directory);
  assert.equal(
    await readFile(
      path.join(directory, "mining-history.json") + result.originalSuffix,
      "utf8",
    ),
    "original",
  );
  assert.equal(
    JSON.parse(
      await readFile(path.join(directory, "mining-history.json"), "utf8"),
    ).blocks.length,
    1,
  );
  backup.history.version = 999;
  await writeFile(backupFile, JSON.stringify(backup));
  await assert.rejects(() => restoreBackup(backupFile, directory));
  assert.equal(
    JSON.parse(
      await readFile(path.join(directory, "mining-history.json"), "utf8"),
    ).blocks.length,
    1,
  );

  backup.history.version = 3;
  await writeFile(backupFile, JSON.stringify(backup));
  const historyPath = path.join(directory, "mining-history.json");
  const metricsPath = path.join(directory, "dashboard-metrics.json");
  const configPath = path.join(directory, "config.yaml");
  const historyBeforeFailure = await readFile(historyPath, "utf8");
  const configBeforeFailure = await readFile(configPath, "utf8");
  await rm(metricsPath);
  let writes = 0;
  await assert.rejects(
    () =>
      restoreBackup(backupFile, directory, async (target, content) => {
        writes += 1;
        if (writes === 3) throw new Error("injected restore failure");
        await atomicWrite(target, content);
      }),
    /injected restore failure/,
  );
  assert.equal(await readFile(historyPath, "utf8"), historyBeforeFailure);
  assert.equal(await readFile(configPath, "utf8"), configBeforeFailure);
  await assert.rejects(readFile(metricsPath, "utf8"), { code: "ENOENT" });
});
