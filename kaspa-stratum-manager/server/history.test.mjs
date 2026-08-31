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
  assert.equal(summary.recentBlocks.length,1);
  assert.equal(summary.blockHistoryDays,90);
  assert.deepEqual(summary.workers.map(({worker})=>worker),["current"]);
});

test("calculates solo-mining performance windows, share freshness, quality, luck, effort, and charts", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-history-performance-"));
  const historyPath = path.join(directory,"mining-history.json");
  const hour = 60 * 60 * 1000;
  let now = Date.parse("2026-08-30T00:00:00Z");
  const store = new MiningHistoryStore({ path:historyPath, now:()=>now, sampleIntervalMs:hour, flushIntervalMs:SEVEN_DAYS_MS });
  for (let index = 0; index <= 25; index += 1) {
    const blocks = index === 12 || index === 24 ? [{ worker:"RIG01", hash:`block-${index}`, timestamp:String(now/1000) }] : [];
    await store.record({
      networkHashrate:100e9,
      networkDifficulty:500 + index,
      networkBlockCount:1_000 + index,
      workers:[{
        instance:"5555",
        worker:"RIG01",
        hashrate:index < 12 ? 2 : 4,
        shares:index * 30,
        staleShares:index >= 18 ? 1 : 0,
        invalidShares:index >= 22 ? 1 : 0,
      }],
      blocks,
    });
    if (index < 25) now += hour;
  }
  await store.close();

  const summary = await store.summary();
  assert.equal(summary.periods.oneHour.averageHashrateHs,4e9);
  assert.equal(summary.periods.sixHours.averageHashrateHs,4e9);
  assert.ok(summary.periods.twentyFourHours.averageHashrateHs > 3e9);
  assert.equal(summary.periods.oneHour.acceptedShares,30);
  assert.equal(summary.periods.oneHour.sharesPerMinute,0.5);
  assert.equal(summary.periods.twentyFourHours.staleShares,1);
  assert.equal(summary.periods.twentyFourHours.invalidShares,1);
  assert.ok(summary.periods.twentyFourHours.rejectionRate > 0);
  assert.equal(summary.workers[0].periods.oneHour.lastAcceptedShareAt,new Date(now).toISOString());
  assert.ok(summary.expectedBlocksObserved > 0);
  assert.equal(summary.blocksFound,2);
  assert.ok(summary.luckRatio > 0);
  assert.ok(summary.currentRoundEffortPercent > 0);
  assert.equal(summary.recentBlocks.length,2);
  assert.ok(summary.recentBlocks[0].effortPercent > 0);
  assert.ok(summary.charts.oneHour.length >= 2);
  assert.ok(summary.charts.sevenDays.length >= 2);

  const persisted = await readFile(historyPath,"utf8");
  assert.doesNotMatch(persisted,/address|secret|private/i);
});

test("atomically resets persisted mining history", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaspa-history-reset-"));
  const historyPath = path.join(directory, "mining-history.json");
  let now = Date.parse("2026-08-30T00:00:00Z");
  const store = new MiningHistoryStore({ path:historyPath, now:()=>now, flushIntervalMs:SEVEN_DAYS_MS });
  await store.record({ networkHashrate:1e12, networkBlockCount:10, workers:[{ worker:"RIG01", hashrateGhs:1000 }] });
  now += 60_000;
  await store.record({ networkHashrate:1e12, networkBlockCount:11, workers:[{ worker:"RIG01", hashrateGhs:1000 }], blocks:[{ worker:"RIG01", hash:"block-reset-test" }] });
  await store.reset();

  const summary = await store.summary();
  assert.equal(summary.sampleCount,0);
  assert.equal(summary.blocksFound,0);
  assert.deepEqual(summary.workers,[]);
  assert.deepEqual(summary.recentBlocks,[]);
  assert.deepEqual(JSON.parse(await readFile(historyPath,"utf8")),{version:2,samples:[],blocks:[]});
});
