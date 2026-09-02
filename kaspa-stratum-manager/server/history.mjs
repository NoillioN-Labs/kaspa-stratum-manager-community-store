import { readFile } from "node:fs/promises";
import { atomicWrite } from "./settings.mjs";

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const BLOCK_HISTORY_MS = 365 * 24 * 60 * 60 * 1000;

const PERIODS = {
  oneHour: 60 * 60 * 1000,
  sixHours: 6 * 60 * 60 * 1000,
  twentyFourHours: 24 * 60 * 60 * 1000,
  sevenDays: SEVEN_DAYS_MS,
};
const CHART_BUCKETS = {
  oneHour: 60_000,
  sixHours: 5 * 60_000,
  twentyFourHours: 15 * 60_000,
  sevenDays: 60 * 60_000,
};
const finite = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const optionalFinite = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;
const text = (value) => typeof value === "string" ? value.trim() : "";
const rewardStatuses = new Set(["unresolved", "unknown", "blue", "red", "error"]);
const blockColors = new Set(["unknown", "blue", "red"]);
const sompi = (value) => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) ? value : null;
const nullableCount = (value) => sompi(typeof value === "number" ? String(value) : value);
const rewardDefaults = () => ({
  rewardStatus: "unresolved",
  blockColor: "unknown",
  confirmationCount: null,
  mergingChainBlockHash: null,
  subsidySompi: null,
  acceptedTxFeesSompi: null,
  dagMergeRewardSompi: null,
  totalRewardSompi: null,
  rewardDecompositionVerified: false,
  rewardResolvedAt: null,
  rewardLastCheckedAt: null,
  rewardError: null,
});
const sanitizedReward = (source = {}) => ({
  rewardStatus: rewardStatuses.has(source.rewardStatus) ? source.rewardStatus : "unresolved",
  blockColor: blockColors.has(source.blockColor) ? source.blockColor : "unknown",
  confirmationCount: nullableCount(source.confirmationCount),
  mergingChainBlockHash: text(source.mergingChainBlockHash).toLowerCase() || null,
  subsidySompi: sompi(source.subsidySompi),
  acceptedTxFeesSompi: sompi(source.acceptedTxFeesSompi),
  dagMergeRewardSompi: sompi(source.dagMergeRewardSompi),
  totalRewardSompi: sompi(source.totalRewardSompi),
  rewardDecompositionVerified: source.rewardDecompositionVerified === true,
  rewardResolvedAt: Number.isFinite(Number(source.rewardResolvedAt)) ? Number(source.rewardResolvedAt) : null,
  rewardLastCheckedAt: Number.isFinite(Number(source.rewardLastCheckedAt)) ? Number(source.rewardLastCheckedAt) : null,
  rewardError: text(source.rewardError).slice(0, 500) || null,
});
const workerName = (worker) => text(worker?.worker || worker?.workerName || worker?.name);
const workerKey = (instance, worker) => `${instance}\u0000${worker}`;
const iso = (timestamp) => timestamp ? new Date(timestamp).toISOString() : null;
const eventTime = (value, fallback) => {
  const numeric = Number(value);
  const parsed = Number.isFinite(numeric) ? numeric * 1000 : Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const counter = (source, names) => {
  for (const name of names) {
    const value = optionalFinite(source?.[name]);
    if (value !== null) return value;
  }
  return null;
};
const counterDelta = (left, right) => left === null || right === null ? null : right >= left ? right - left : right;
const emptyData = () => ({ version: 3, samples: [], blocks: [] });

const sanitizedWorker = (source, stored = false) => {
  const worker = workerName(source);
  if (!worker) return null;
  return {
    instance: text(source.instance),
    worker,
    hashrateHs: finite(stored ? source.hashrateHs : finite(source.hashrateGhs ?? source.hashrate) * 1e9),
    acceptedShares: counter(source, ["acceptedShares", "shares"]),
    staleShares: counter(source, ["staleShares", "stales"]),
    invalidShares: counter(source, ["invalidShares", "rejectedShares", "invalid"]),
  };
};

const sanitizedSample = (stats, timestamp) => ({
  timestamp,
  networkHashrate: finite(stats?.networkHashrate),
  networkDifficulty: finite(stats?.networkDifficulty),
  networkBlockCount: finite(stats?.networkBlockCount),
  workers: (Array.isArray(stats?.workers) ? stats.workers : []).map((source) => sanitizedWorker(source)).filter(Boolean),
});

const validStoredData = (input) => {
  if (!input || ![1, 2, 3].includes(input.version) || !Array.isArray(input.samples) || !Array.isArray(input.blocks)) return emptyData();
  return {
    version: 3,
    samples: input.samples.filter((sample) => Number.isFinite(sample?.timestamp) && Array.isArray(sample?.workers)).map((sample) => ({
      timestamp: sample.timestamp,
      networkHashrate: finite(sample.networkHashrate),
      networkDifficulty: finite(sample.networkDifficulty),
      networkBlockCount: finite(sample.networkBlockCount),
      workers: sample.workers.map((source) => sanitizedWorker(source, true)).filter(Boolean),
    })),
    blocks: input.blocks.flatMap((source) => {
      const hash = text(source?.hash);
      const worker = workerName(source);
      if (!hash || !worker || !Number.isFinite(source?.timestamp)) return [];
      return [{
        hash,
        instance: text(source.instance),
        worker,
        timestamp: source.timestamp,
        networkDifficulty: finite(source.networkDifficulty),
        networkBlockCount: finite(source.networkBlockCount),
        ...sanitizedReward(source),
      }];
    }),
  };
};

const outlook = (expected, coverageSeconds, windowSeconds) => {
  if (!(coverageSeconds > 0) || !(expected > 0)) {
    return { expectedBlocksNextWindow: null, probabilityNextWindow: null, probabilityNoBlockNextWindow: null, estimatedTimeToBlockSeconds: null };
  }
  const expectedBlocksNextWindow = expected / coverageSeconds * windowSeconds;
  return {
    expectedBlocksNextWindow,
    probabilityNextWindow: 1 - Math.exp(-expectedBlocksNextWindow),
    probabilityNoBlockNextWindow: Math.exp(-expectedBlocksNextWindow),
    estimatedTimeToBlockSeconds: coverageSeconds / expected,
  };
};

const intervalExpected = (previous, current, worker = null) => {
  const networkHashrate = (previous.networkHashrate + current.networkHashrate) / 2;
  const networkBlocks = current.networkBlockCount - previous.networkBlockCount;
  if (!(networkHashrate > 0) || !(networkBlocks >= 0)) return 0;
  if (!worker) {
    const left = previous.workers.reduce((sum, item) => sum + item.hashrateHs, 0);
    const right = current.workers.reduce((sum, item) => sum + item.hashrateHs, 0);
    return ((left + right) / 2) / networkHashrate * networkBlocks;
  }
  const key = workerKey(worker.instance, worker.worker);
  const left = previous.workers.find((item) => workerKey(item.instance, item.worker) === key)?.hashrateHs ?? 0;
  const right = current.workers.find((item) => workerKey(item.instance, item.worker) === key)?.hashrateHs ?? 0;
  return ((left + right) / 2) / networkHashrate * networkBlocks;
};

const expectedBetween = (samples, start, end, sampleIntervalMs) => {
  let expected = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const interval = current.timestamp - previous.timestamp;
    if (!(interval > 0) || interval > sampleIntervalMs * 3) continue;
    const overlap = Math.max(0, Math.min(current.timestamp, end) - Math.max(previous.timestamp, start));
    if (overlap > 0) expected += intervalExpected(previous, current) * overlap / interval;
  }
  return expected;
};

const shareSummary = (source, coverageSeconds) => {
  const rejected = (source.staleReported ? source.staleShares : 0) + (source.invalidReported ? source.invalidShares : 0);
  const qualityReported = source.staleReported || source.invalidReported;
  return {
    acceptedShares: source.acceptedShares,
    staleShares: source.staleReported ? source.staleShares : null,
    invalidShares: source.invalidReported ? source.invalidShares : null,
    rejectionRate: qualityReported && source.acceptedShares + rejected > 0 ? rejected / (source.acceptedShares + rejected) : null,
    sharesPerMinute: coverageSeconds > 0 ? source.acceptedShares / (coverageSeconds / 60) : null,
  };
};

const periodSummary = (allSamples, blocks, cutoff, windowMs, sampleIntervalMs) => {
  const samples = allSamples.filter(({ timestamp }) => timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
  const workers = new Map();
  const aggregate = { hashSeconds: 0, onlineSeconds: 0, networkHashSeconds: 0, networkDifficultySeconds: 0, networkCoverageSeconds: 0, networkBlocks: 0, expected: 0, acceptedShares: 0, staleShares: 0, invalidShares: 0, staleReported: false, invalidReported: false, lastAcceptedShareAt: null };
  let coverageSeconds = 0;
  const ensure = (instance, worker) => {
    const key = workerKey(instance, worker);
    if (!workers.has(key)) workers.set(key, { instance, worker, hashSeconds: 0, onlineSeconds: 0, expected: 0, acceptedShares: 0, staleShares: 0, invalidShares: 0, staleReported: false, invalidReported: false, lastSeenAt: null, lastAcceptedShareAt: null });
    return workers.get(key);
  };
  for (const sample of samples) for (const worker of sample.workers) {
    const target = ensure(worker.instance, worker.worker);
    target.lastSeenAt = Math.max(target.lastSeenAt ?? 0, sample.timestamp);
  }
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const seconds = (current.timestamp - previous.timestamp) / 1000;
    if (!(seconds > 0) || seconds > sampleIntervalMs / 1000 * 3) continue;
    coverageSeconds += seconds;
    const previousWorkers = new Map(previous.workers.map((worker) => [workerKey(worker.instance, worker.worker), worker]));
    const currentWorkers = new Map(current.workers.map((worker) => [workerKey(worker.instance, worker.worker), worker]));
    const keys = new Set([...previousWorkers.keys(), ...currentWorkers.keys()]);
    let intervalHashrate = 0;
    for (const key of keys) {
      const left = previousWorkers.get(key);
      const right = currentWorkers.get(key);
      const instance = right?.instance ?? left?.instance ?? "";
      const name = right?.worker ?? left?.worker ?? "";
      const hashrate = ((left?.hashrateHs ?? 0) + (right?.hashrateHs ?? 0)) / 2;
      const target = ensure(instance, name);
      target.hashSeconds += hashrate * seconds;
      target.expected += intervalExpected(previous, current, target);
      intervalHashrate += hashrate;
      if (left || right) target.onlineSeconds += seconds;
      const accepted = counterDelta(left?.acceptedShares ?? null, right?.acceptedShares ?? null);
      const stale = counterDelta(left?.staleShares ?? null, right?.staleShares ?? null);
      const invalid = counterDelta(left?.invalidShares ?? null, right?.invalidShares ?? null);
      if (accepted !== null) {
        target.acceptedShares += accepted;
        aggregate.acceptedShares += accepted;
        if (accepted > 0) { target.lastAcceptedShareAt = current.timestamp; aggregate.lastAcceptedShareAt = current.timestamp; }
      }
      if (stale !== null) { target.staleShares += stale; target.staleReported = true; aggregate.staleShares += stale; aggregate.staleReported = true; }
      if (invalid !== null) { target.invalidShares += invalid; target.invalidReported = true; aggregate.invalidShares += invalid; aggregate.invalidReported = true; }
    }
    aggregate.hashSeconds += intervalHashrate * seconds;
    if (intervalHashrate > 0) aggregate.onlineSeconds += seconds;
    const networkHashrate = (previous.networkHashrate + current.networkHashrate) / 2;
    const networkBlocks = current.networkBlockCount - previous.networkBlockCount;
    if (networkHashrate > 0 && networkBlocks >= 0) {
      aggregate.networkHashSeconds += networkHashrate * seconds;
      aggregate.networkDifficultySeconds += (previous.networkDifficulty + current.networkDifficulty) / 2 * seconds;
      aggregate.networkCoverageSeconds += seconds;
      aggregate.networkBlocks += networkBlocks;
      aggregate.expected += intervalExpected(previous, current);
    }
  }
  const periodBlocks = blocks.filter(({ timestamp }) => timestamp >= cutoff);
  return {
    windowSeconds: windowMs / 1000,
    sampleCount: samples.length,
    coverageSeconds,
    averageHashrateHs: coverageSeconds ? aggregate.hashSeconds / coverageSeconds : 0,
    availabilityRatio: coverageSeconds ? aggregate.onlineSeconds / coverageSeconds : null,
    expectedBlocksObserved: aggregate.expected,
    actualBlocksObserved: periodBlocks.length,
    luckRatio: aggregate.expected > 0 ? periodBlocks.length / aggregate.expected : null,
    averageNetworkHashrateHs: aggregate.networkCoverageSeconds ? aggregate.networkHashSeconds / aggregate.networkCoverageSeconds : 0,
    averageNetworkDifficulty: aggregate.networkCoverageSeconds ? aggregate.networkDifficultySeconds / aggregate.networkCoverageSeconds : 0,
    networkBlocksObserved: aggregate.networkBlocks,
    lastAcceptedShareAt: iso(aggregate.lastAcceptedShareAt),
    ...shareSummary(aggregate, coverageSeconds),
    workers: [...workers.values()].map((worker) => ({
      instance: worker.instance,
      worker: worker.worker,
      averageHashrateHs: coverageSeconds ? worker.hashSeconds / coverageSeconds : 0,
      availabilityRatio: coverageSeconds ? worker.onlineSeconds / coverageSeconds : null,
      expectedBlocksObserved: worker.expected,
      lastSeenAt: iso(worker.lastSeenAt),
      lastAcceptedShareAt: iso(worker.lastAcceptedShareAt),
      ...shareSummary(worker, coverageSeconds),
    })),
  };
};

const chart = (samples, cutoff, bucketMs) => {
  const buckets = new Map();
  for (const sample of samples) {
    if (sample.timestamp < cutoff) continue;
    const timestamp = Math.floor(sample.timestamp / bucketMs) * bucketMs;
    const hashrateHs = sample.workers.reduce((sum, worker) => sum + worker.hashrateHs, 0);
    const target = buckets.get(timestamp) ?? { timestamp, total: 0, count: 0 };
    target.total += hashrateHs;
    target.count += 1;
    buckets.set(timestamp, target);
  }
  return [...buckets.values()].sort((left, right) => left.timestamp - right.timestamp).map(({ timestamp, total, count }) => ({ timestamp, hashrateHs: count ? total / count : 0 }));
};

export class MiningHistoryStore {
  constructor({ path, retentionMs = SEVEN_DAYS_MS, blockRetentionMs = BLOCK_HISTORY_MS, sampleIntervalMs = 60_000, flushIntervalMs = 300_000, now = () => Date.now(), onError = () => {} }) {
    this.path = path;
    this.retentionMs = retentionMs;
    this.blockRetentionMs = blockRetentionMs;
    this.sampleIntervalMs = sampleIntervalMs;
    this.flushIntervalMs = flushIntervalMs;
    this.now = now;
    this.onError = onError;
    this.data = emptyData();
    this.loaded = false;
    this.dirty = false;
    this.lastFlush = 0;
    this.tail = Promise.resolve();
  }

  queue(operation) { const result = this.tail.then(operation, operation); this.tail = result.catch(() => {}); return result; }

  async loadUnlocked() {
    if (this.loaded) return;
    try {
      const stored = JSON.parse(await readFile(this.path, "utf8"));
      this.data = validStoredData(stored);
      if (stored.version !== 3) this.dirty = true;
    }
    catch (error) {
      if (error.code !== "ENOENT") this.onError(`Mining history could not be read and was reset: ${error.message}`);
      this.data = emptyData();
    }
    this.loaded = true;
    this.pruneUnlocked(this.now());
  }

  pruneUnlocked(now) {
    this.data.samples = this.data.samples.filter(({ timestamp }) => timestamp >= now - this.retentionMs && timestamp <= now + this.sampleIntervalMs);
    this.data.blocks = this.data.blocks.filter(({ timestamp }) => timestamp >= now - this.blockRetentionMs && timestamp <= now + this.sampleIntervalMs);
  }

  async flushUnlocked(force = false) {
    const now = this.now();
    if (!this.dirty || (!force && now - this.lastFlush < this.flushIntervalMs)) return;
    await atomicWrite(this.path, `${JSON.stringify(this.data)}\n`);
    this.dirty = false;
    this.lastFlush = now;
  }

  record(stats, timestamp = this.now()) {
    return this.queue(async () => {
      await this.loadUnlocked();
      const sample = sanitizedSample(stats, timestamp);
      const latest = this.data.samples.at(-1);
      if (latest && timestamp - latest.timestamp < this.sampleIntervalMs / 2) this.data.samples[this.data.samples.length - 1] = sample;
      else this.data.samples.push(sample);
      const known = new Set(this.data.blocks.map(({ hash }) => hash));
      let addedBlock = false;
      for (const source of Array.isArray(stats?.blocks) ? stats.blocks : []) {
        const hash = text(source?.hash);
        const worker = workerName(source);
        if (!hash || !worker || known.has(hash)) continue;
        this.data.blocks.push({ hash, instance: text(source.instance), worker, timestamp: eventTime(source.timestamp, timestamp), networkDifficulty: finite(stats?.networkDifficulty), networkBlockCount: finite(stats?.networkBlockCount), ...rewardDefaults() });
        known.add(hash);
        addedBlock = true;
      }
      this.pruneUnlocked(timestamp);
      this.dirty = true;
      await this.flushUnlocked(addedBlock);
    });
  }

  summary(windowMs = this.retentionMs) {
    return this.queue(async () => {
      await this.loadUnlocked();
      const now = this.now();
      this.pruneUnlocked(now);
      const summaryWindow = Math.min(Math.max(windowMs, this.sampleIntervalMs), this.retentionMs);
      const cutoff = now - summaryWindow;
      const periodsWithWorkers = Object.fromEntries(Object.entries(PERIODS).map(([name, duration]) => [name, periodSummary(this.data.samples, this.data.blocks, now - duration, duration, this.sampleIntervalMs)]));
      const primary = periodSummary(this.data.samples, this.data.blocks, cutoff, summaryWindow, this.sampleIntervalMs);
      const blocksInWindow = this.data.blocks.filter(({ timestamp }) => timestamp >= cutoff);
      const samplesInWindow = this.data.samples.filter(({ timestamp }) => timestamp >= cutoff).sort((left, right) => left.timestamp - right.timestamp);
      const workerIds = new Set([
        ...Object.values(periodsWithWorkers).flatMap((period) => period.workers.map((worker) => workerKey(worker.instance, worker.worker))),
        ...blocksInWindow.map((block) => workerKey(block.instance, block.worker)),
      ]);
      const workerSummaries = [...workerIds].map((key) => {
        const allWorkers = Object.values(periodsWithWorkers).flatMap((period) => period.workers);
        const identity = allWorkers.find((worker) => workerKey(worker.instance, worker.worker) === key);
        const periodMap = Object.fromEntries(Object.entries(periodsWithWorkers).map(([name, period]) => [name, period.workers.find((worker) => workerKey(worker.instance, worker.worker) === key) ?? null]));
        const found = blocksInWindow.filter((block) => workerKey(block.instance, block.worker) === key);
        const expected = primary.workers.find((worker) => workerKey(worker.instance, worker.worker) === key)?.expectedBlocksObserved ?? 0;
        return {
          instance: identity?.instance ?? found[0]?.instance ?? "",
          worker: identity?.worker ?? found[0]?.worker ?? "",
          averageHashrateHs: periodMap.sevenDays?.averageHashrateHs ?? 0,
          blocksFound: found.length,
          lastBlockAt: iso(Math.max(0, ...found.map(({ timestamp }) => timestamp))),
          expectedBlocksObserved: expected,
          periods: periodMap,
          ...outlook(expected, primary.coverageSeconds, summaryWindow / 1000),
        };
      }).sort((left, right) => right.averageHashrateHs - left.averageHashrateHs || left.worker.localeCompare(right.worker));
      const blockEvents = [...this.data.blocks].sort((left, right) => left.timestamp - right.timestamp);
      const recentBlocks = blockEvents.slice(-20).reverse().map((block) => {
        const position = blockEvents.indexOf(block);
        const previous = position > 0 ? blockEvents[position - 1] : null;
        const start = previous?.timestamp ?? samplesInWindow[0]?.timestamp ?? block.timestamp;
        const effort = expectedBetween(this.data.samples, start, block.timestamp, this.sampleIntervalMs);
        const completeRound = Boolean(previous && start >= (this.data.samples[0]?.timestamp ?? start));
        return { hash: block.hash, instance: block.instance, worker: block.worker, timestamp: iso(block.timestamp), networkDifficulty: block.networkDifficulty, networkBlockCount: block.networkBlockCount, effortPercent: effort > 0 ? effort * 100 : null, completeRound, ...sanitizedReward(block) };
      });
      const lastBlock = blockEvents.at(-1);
      const roundStart = lastBlock?.timestamp ?? samplesInWindow[0]?.timestamp ?? null;
      const currentRoundExpected = roundStart ? expectedBetween(this.data.samples, roundStart, now, this.sampleIntervalMs) : 0;
      const currentRoundComplete = Boolean(lastBlock && lastBlock.timestamp >= (this.data.samples[0]?.timestamp ?? lastBlock.timestamp));
      const withoutWorkers = (period) => {
        const sanitized = { ...period };
        delete sanitized.workers;
        return sanitized;
      };
      return {
        windowDays: summaryWindow / (24 * 60 * 60 * 1000),
        sampleCount: primary.sampleCount,
        coverageSeconds: primary.coverageSeconds,
        startedAt: iso(samplesInWindow[0]?.timestamp),
        lastSampleAt: iso(samplesInWindow.at(-1)?.timestamp),
        averageHashrateHs: primary.averageHashrateHs,
        averageNetworkHashrateHs: primary.averageNetworkHashrateHs,
        averageNetworkDifficulty: primary.averageNetworkDifficulty,
        networkBlocksObserved: primary.networkBlocksObserved,
        blocksFound: blocksInWindow.length,
        lastBlockAt: iso(Math.max(0, ...blocksInWindow.map(({ timestamp }) => timestamp))),
        expectedBlocksObserved: primary.expectedBlocksObserved,
        luckRatio: primary.luckRatio,
        currentRoundEffortPercent: currentRoundExpected > 0 ? currentRoundExpected * 100 : null,
        currentRoundStartedAt: iso(roundStart),
        currentRoundComplete,
        blockHistoryDays: this.blockRetentionMs / (24 * 60 * 60 * 1000),
        periods: Object.fromEntries(Object.entries(periodsWithWorkers).map(([name, period]) => [name, withoutWorkers(period)])),
        charts: Object.fromEntries(Object.entries(PERIODS).map(([name, duration]) => [name, chart(this.data.samples, now - duration, CHART_BUCKETS[name])])),
        recentBlocks,
        ...outlook(primary.expectedBlocksObserved, primary.coverageSeconds, summaryWindow / 1000),
        workers: workerSummaries,
      };
    });
  }

  reset() {
    return this.queue(async () => {
      await this.loadUnlocked();
      this.data = emptyData();
      this.dirty = true;
      await this.flushUnlocked(true);
    });
  }

  rewardBlocks(limit = 100) {
    return this.queue(async () => {
      await this.loadUnlocked();
      const safeLimit = Math.min(1_000, Math.max(1, Number(limit) || 100));
      return [...this.data.blocks].sort((left, right) => right.timestamp - left.timestamp).slice(0, safeLimit).map((block) => ({
        hash: block.hash,
        instance: block.instance,
        worker: block.worker,
        timestamp: iso(block.timestamp),
        ...sanitizedReward(block),
      }));
    });
  }

  unresolvedRewardBlocks(limit = 20) {
    return this.queue(async () => {
      await this.loadUnlocked();
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
      return this.data.blocks.filter(({ rewardStatus }) => ["unresolved", "unknown", "error"].includes(rewardStatus)).sort((left, right) => left.timestamp - right.timestamp).slice(0, safeLimit).map((block) => ({ hash: block.hash, rewardStatus: block.rewardStatus, rewardLastCheckedAt: block.rewardLastCheckedAt }));
    });
  }

  updateBlockReward(value, patch) {
    return this.queue(async () => {
      await this.loadUnlocked();
      const hash = text(value).toLowerCase();
      const block = this.data.blocks.find((candidate) => candidate.hash.toLowerCase() === hash);
      if (!block) return false;
      Object.assign(block, sanitizedReward({ ...block, ...patch }));
      this.dirty = true;
      await this.flushUnlocked(true);
      return true;
    });
  }

  rewardSummary(windowMs = this.blockRetentionMs) {
    return this.queue(async () => {
      await this.loadUnlocked();
      const now = this.now();
      const duration = Math.min(Math.max(Number(windowMs) || SEVEN_DAYS_MS, 60_000), this.blockRetentionMs);
      const blocks = this.data.blocks.filter(({ timestamp }) => timestamp >= now - duration);
      const totals = { subsidy: 0n, fees: 0n, dag: 0n, realised: 0n };
      let blue = 0; let red = 0; let pending = 0; let errors = 0; let decomposed = 0;
      const buckets = new Map();
      for (const block of blocks) {
        if (block.rewardStatus === "blue") blue += 1;
        else if (block.rewardStatus === "red") red += 1;
        else if (block.rewardStatus === "error") errors += 1;
        else pending += 1;
        const total = sompi(block.totalRewardSompi);
        if (total !== null) totals.realised += BigInt(total);
        if (block.rewardDecompositionVerified) {
          decomposed += 1;
          totals.subsidy += BigInt(sompi(block.subsidySompi) ?? "0");
          totals.fees += BigInt(sompi(block.acceptedTxFeesSompi) ?? "0");
          totals.dag += BigInt(sompi(block.dagMergeRewardSompi) ?? "0");
        }
        const bucketTimestamp = Math.floor(block.timestamp / 86_400_000) * 86_400_000;
        const bucket = buckets.get(bucketTimestamp) ?? { timestamp: iso(bucketTimestamp), blocks: 0, totalRewardSompi: 0n };
        bucket.blocks += 1;
        if (total !== null) bucket.totalRewardSompi += BigInt(total);
        buckets.set(bucketTimestamp, bucket);
      }
      return {
        periodSeconds: duration / 1000,
        blocksFound: blocks.length,
        blueBlocks: blue,
        redBlocks: red,
        pendingBlocks: pending,
        errorBlocks: errors,
        subsidySompi: totals.subsidy.toString(),
        acceptedTxFeesSompi: totals.fees.toString(),
        dagMergeRewardSompi: totals.dag.toString(),
        totalRewardSompi: totals.realised.toString(),
        decompositionCoverage: blue > 0 ? decomposed / blue : null,
        feeShare: totals.realised > 0n ? Number(totals.fees * 1_000_000n / totals.realised) / 1_000_000 : null,
        daily: [...buckets.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp)).map((bucket) => ({ ...bucket, totalRewardSompi: bucket.totalRewardSompi.toString() })),
      };
    });
  }

  close() { return this.queue(async () => { await this.loadUnlocked(); await this.flushUnlocked(true); }); }
}
