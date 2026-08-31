import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DashboardMetricsStore, TEN_MINUTES_MS } from "./metrics.mjs";

test("persists rolling dashboard readings and cumulative shares across reloads", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-metrics-"));
  const metricsPath = path.join(directory, "dashboard-metrics.json");
  let now = Date.parse("2026-08-30T00:00:00Z");
  const stats = (totalShares, hashrateGhs = 10) => ({
    activeWorkers: 1,
    totalShares,
    workers: [{ worker: "RIG01", wallet: "must-not-persist", hashrateGhs }],
  });
  const store = new DashboardMetricsStore({ path: metricsPath, now: () => now, flushIntervalMs: TEN_MINUTES_MS });
  await store.record(stats(100));
  now += 5_000;
  await store.record(stats(103, 12));
  await store.close();

  const persisted = await readFile(metricsPath, "utf8");
  assert.doesNotMatch(persisted, /wallet|RIG01|must-not-persist/);
  const reloaded = new DashboardMetricsStore({ path: metricsPath, now: () => now });
  let summary = await reloaded.summary();
  assert.equal(summary.samples.length, 2);
  assert.equal(summary.samples[1].hashrateHs, 12e9);
  assert.equal(summary.acceptedSharesTotal, 103);

  now += 5_000;
  await reloaded.record(stats(2, 11));
  summary = await reloaded.summary();
  assert.equal(summary.acceptedSharesTotal, 105);
  assert.equal(summary.samples.at(-1).acceptedSharesTotal, 105);
});

test("keeps only the rolling ten-minute dashboard window", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-metrics-prune-"));
  const metricsPath = path.join(directory, "dashboard-metrics.json");
  let now = Date.parse("2026-08-30T00:00:00Z");
  const store = new DashboardMetricsStore({ path: metricsPath, now: () => now });
  await store.record({ activeWorkers: 1, totalShares: 1, workers: [{ hashrate: 1 }] });
  now += TEN_MINUTES_MS + 5_000;
  await store.record({ activeWorkers: 2, totalShares: 2, workers: [{ hashrate: 2 }] });
  const summary = await store.summary();
  assert.equal(summary.samples.length, 1);
  assert.equal(summary.samples[0].connectedMiners, 2);
  assert.equal(summary.acceptedSharesTotal, 2);
});

test("resets displayed dashboard history while retaining the bridge counter baseline", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-metrics-reset-"));
  const metricsPath = path.join(directory, "dashboard-metrics.json");
  let now = Date.parse("2026-08-30T00:00:00Z");
  const store = new DashboardMetricsStore({ path:metricsPath, now:()=>now, flushIntervalMs:TEN_MINUTES_MS });
  await store.record({ activeWorkers:1, totalShares:100, workers:[{ hashrateGhs:10 }] });
  await store.reset();
  let summary = await store.summary();
  assert.equal(summary.acceptedSharesTotal,0);
  assert.deepEqual(summary.samples,[]);

  now += 5_000;
  await store.record({ activeWorkers:1, totalShares:103, workers:[{ hashrateGhs:11 }] });
  summary = await store.summary();
  assert.equal(summary.acceptedSharesTotal,3);
  assert.equal(summary.samples.length,1);
  await store.close();
  const persisted = JSON.parse(await readFile(metricsPath,"utf8"));
  assert.equal(persisted.acceptedSharesTotal,3);
  assert.equal(persisted.samples.length,1);
});
