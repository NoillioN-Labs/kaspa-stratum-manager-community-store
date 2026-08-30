import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MiningHistoryStore, SEVEN_DAYS_MS } from "./history.mjs";

test("persists sanitized seven-day samples, confirmed blocks, and probability estimates", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-history-"));
  const historyPath = path.join(directory, "mining-history.json");
  let now = Date.parse("2026-08-30T00:00:00Z");
  const store = new MiningHistoryStore({ path:historyPath, now:()=>now, flushIntervalMs:SEVEN_DAYS_MS });
  const stats = (networkBlockCount, blocks = []) => ({
    networkHashrate:1e12,
    networkDifficulty:123,
    networkBlockCount,
    workers:[{instance:"5555",worker:"RIG01",wallet:"must-not-persist",hashrate:10}],
    blocks,
  });

  await store.record(stats(100));
  now += 60_000;
  await store.record(stats(101,[{instance:"5555",worker:"RIG01",wallet:"must-not-persist",hash:"block-a",timestamp:String(now/1000)}]));
  now += 60_000;
  await store.record(stats(102,[{instance:"5555",worker:"RIG01",wallet:"must-not-persist",hash:"block-a",timestamp:String((now-60_000)/1000)}]));
  await store.close();

  const persisted = await readFile(historyPath,"utf8");
  assert.doesNotMatch(persisted,/wallet|must-not-persist/);
  const reloaded = new MiningHistoryStore({ path:historyPath, now:()=>now });
  const summary = await reloaded.summary();
  assert.equal(summary.sampleCount,3);
  assert.equal(summary.coverageSeconds,120);
  assert.equal(summary.averageHashrateHs,10e9);
  assert.equal(summary.averageNetworkHashrateHs,1e12);
  assert.equal(summary.averageNetworkDifficulty,123);
  assert.equal(summary.networkBlocksObserved,2);
  assert.equal(summary.blocksFound,1);
  assert.equal(summary.workers.length,1);
  assert.equal(summary.workers[0].blocksFound,1);
  assert.equal(summary.workers[0].averageHashrateHs,10e9);
  assert.ok(Math.abs(summary.expectedBlocksNextWindow-100.8)<1e-9);
  assert.equal(summary.estimatedTimeToBlockSeconds,6000);
  assert.ok(summary.probabilityNextWindow>0.999);
});

test("prunes samples and block events outside the seven-day window", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-history-prune-"));
  const historyPath = path.join(directory,"mining-history.json");
  let now = Date.parse("2026-08-20T00:00:00Z");
  const store = new MiningHistoryStore({ path:historyPath, now:()=>now });
  await store.record({networkHashrate:1e12,networkBlockCount:1,workers:[{worker:"old",hashrate:1}],blocks:[{worker:"old",hash:"old-block",timestamp:String(now/1000)}]});
  now += SEVEN_DAYS_MS + 60_000;
  await store.record({networkHashrate:1e12,networkBlockCount:2,workers:[{worker:"current",hashrate:1}],blocks:[]});
  const summary = await store.summary();
  assert.equal(summary.sampleCount,1);
  assert.equal(summary.blocksFound,0);
  assert.deepEqual(summary.workers.map(({worker})=>worker),["current"]);
});

