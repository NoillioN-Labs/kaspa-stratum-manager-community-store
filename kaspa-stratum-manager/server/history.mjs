import { readFile } from "node:fs/promises";
import { atomicWrite } from "./settings.mjs";

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const finite = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const text = (value) => typeof value === "string" ? value.trim() : "";
const workerName = (worker) => text(worker?.worker || worker?.workerName || worker?.name);
const workerKey = (instance, worker) => `${instance}\u0000${worker}`;
const iso = (timestamp) => timestamp ? new Date(timestamp).toISOString() : null;
const eventTime = (value, fallback) => {
  const numeric = Number(value);
  const parsed = Number.isFinite(numeric) ? numeric * 1000 : Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const emptyData = () => ({ version: 1, samples: [], blocks: [] });

const sanitizedSample = (stats, timestamp) => ({
  timestamp,
  networkHashrate: finite(stats?.networkHashrate),
  networkDifficulty: finite(stats?.networkDifficulty),
  networkBlockCount: finite(stats?.networkBlockCount),
  workers: (Array.isArray(stats?.workers) ? stats.workers : []).flatMap((source) => {
    const worker = workerName(source);
    if (!worker) return [];
    return [{
      instance: text(source.instance),
      worker,
      hashrateHs: finite(source.hashrateGhs ?? source.hashrate) * 1e9,
    }];
  }),
});

const validStoredData = (input) => {
  if (!input || input.version !== 1 || !Array.isArray(input.samples) || !Array.isArray(input.blocks)) return emptyData();
  return {
    version: 1,
    samples: input.samples.filter((sample) => Number.isFinite(sample?.timestamp) && Array.isArray(sample?.workers)).map((sample) => ({
      timestamp: sample.timestamp,
      networkHashrate: finite(sample.networkHashrate),
      networkDifficulty: finite(sample.networkDifficulty),
      networkBlockCount: finite(sample.networkBlockCount),
      workers: sample.workers.flatMap((source) => {
        const worker = workerName(source);
        if (!worker) return [];
        return [{ instance: text(source.instance), worker, hashrateHs: finite(source.hashrateHs) }];
      }),
    })),
    blocks: input.blocks.flatMap((source) => {
      const hash = text(source?.hash);
      const worker = workerName(source);
      if (!hash || !worker || !Number.isFinite(source?.timestamp)) return [];
      return [{ hash, instance: text(source.instance), worker, timestamp: source.timestamp }];
    }),
  };
};

const outlook = (expected, coverageSeconds, windowSeconds) => {
  if (!(coverageSeconds > 0) || !(expected > 0)) {
    return { expectedBlocksNextWindow: null, probabilityNextWindow: null, estimatedTimeToBlockSeconds: null };
  }
  const expectedBlocksNextWindow = expected / coverageSeconds * windowSeconds;
  return {
    expectedBlocksNextWindow,
    probabilityNextWindow: 1 - Math.exp(-expectedBlocksNextWindow),
    estimatedTimeToBlockSeconds: coverageSeconds / expected,
  };
};

export class MiningHistoryStore {
  constructor({
    path,
    retentionMs = SEVEN_DAYS_MS,
    sampleIntervalMs = 60_000,
    flushIntervalMs = 300_000,
    now = () => Date.now(),
    onError = () => {},
  }) {
    this.path = path;
    this.retentionMs = retentionMs;
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

  queue(operation) {
    const result = this.tail.then(operation, operation);
    this.tail = result.catch(() => {});
    return result;
  }

  async loadUnlocked() {
    if (this.loaded) return;
    try { this.data = validStoredData(JSON.parse(await readFile(this.path, "utf8"))); }
    catch (error) {
      if (error.code !== "ENOENT") this.onError(`Mining history could not be read and was reset: ${error.message}`);
      this.data = emptyData();
    }
    this.loaded = true;
    this.pruneUnlocked(this.now());
  }

  pruneUnlocked(now) {
    const cutoff = now - this.retentionMs;
    this.data.samples = this.data.samples.filter(({ timestamp }) => timestamp >= cutoff && timestamp <= now + this.sampleIntervalMs);
    this.data.blocks = this.data.blocks.filter(({ timestamp }) => timestamp >= cutoff && timestamp <= now + this.sampleIntervalMs);
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
        this.data.blocks.push({
          hash,
          instance: text(source.instance),
          worker,
          timestamp: eventTime(source.timestamp, timestamp),
        });
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
      const cutoff = now - Math.min(Math.max(windowMs, this.sampleIntervalMs), this.retentionMs);
      const samples = this.data.samples.filter(({ timestamp }) => timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
      const blocks = this.data.blocks.filter(({ timestamp }) => timestamp >= cutoff);
      const workers = new Map();
      const aggregate = { hashSeconds: 0, networkHashSeconds: 0, networkDifficultySeconds: 0, networkBlocks: 0, expected: 0 };
      let coverageSeconds = 0;

      const ensure = (instance, worker) => {
        const key = workerKey(instance, worker);
        if (!workers.has(key)) workers.set(key, { instance, worker, hashSeconds: 0, expected: 0 });
        return workers.get(key);
      };
      for (const sample of samples) for (const worker of sample.workers) ensure(worker.instance, worker.worker);
      for (const block of blocks) ensure(block.instance, block.worker);

      for (let index = 1; index < samples.length; index += 1) {
        const previous = samples[index - 1];
        const current = samples[index];
        const seconds = (current.timestamp - previous.timestamp) / 1000;
        if (!(seconds > 0) || seconds > this.sampleIntervalMs / 1000 * 3) continue;
        const networkHashrate = (previous.networkHashrate + current.networkHashrate) / 2;
        const networkBlocks = current.networkBlockCount - previous.networkBlockCount;
        if (!(networkHashrate > 0) || !(networkBlocks >= 0)) continue;
        coverageSeconds += seconds;
        aggregate.networkHashSeconds += networkHashrate * seconds;
        aggregate.networkDifficultySeconds += (previous.networkDifficulty + current.networkDifficulty) / 2 * seconds;
        aggregate.networkBlocks += networkBlocks;
        const previousWorkers = new Map(previous.workers.map((worker) => [workerKey(worker.instance, worker.worker), worker]));
        const currentWorkers = new Map(current.workers.map((worker) => [workerKey(worker.instance, worker.worker), worker]));
        const keys = new Set([...previousWorkers.keys(), ...currentWorkers.keys()]);
        for (const key of keys) {
          const left = previousWorkers.get(key);
          const right = currentWorkers.get(key);
          const instance = right?.instance ?? left?.instance ?? "";
          const name = right?.worker ?? left?.worker ?? "";
          const hashrate = ((left?.hashrateHs ?? 0) + (right?.hashrateHs ?? 0)) / 2;
          const target = ensure(instance, name);
          target.hashSeconds += hashrate * seconds;
          target.expected += hashrate / networkHashrate * networkBlocks;
          aggregate.hashSeconds += hashrate * seconds;
          aggregate.expected += hashrate / networkHashrate * networkBlocks;
        }
      }

      const windowSeconds = windowMs / 1000;
      const blockDetails = (instance, worker) => {
        const matches = blocks.filter((block) => block.instance === instance && block.worker === worker);
        return {
          blocksFound: matches.length,
          lastBlockAt: iso(Math.max(0, ...matches.map(({ timestamp }) => timestamp))),
        };
      };
      const workerSummaries = [...workers.values()].map((worker) => ({
        instance: worker.instance,
        worker: worker.worker,
        averageHashrateHs: coverageSeconds ? worker.hashSeconds / coverageSeconds : 0,
        ...blockDetails(worker.instance, worker.worker),
        ...outlook(worker.expected, coverageSeconds, windowSeconds),
      })).sort((left, right) => right.averageHashrateHs - left.averageHashrateHs || left.worker.localeCompare(right.worker));

      return {
        windowDays: windowMs / (24 * 60 * 60 * 1000),
        sampleCount: samples.length,
        coverageSeconds,
        startedAt: iso(samples[0]?.timestamp),
        lastSampleAt: iso(samples.at(-1)?.timestamp),
        averageHashrateHs: coverageSeconds ? aggregate.hashSeconds / coverageSeconds : 0,
        averageNetworkHashrateHs: coverageSeconds ? aggregate.networkHashSeconds / coverageSeconds : 0,
        averageNetworkDifficulty: coverageSeconds ? aggregate.networkDifficultySeconds / coverageSeconds : 0,
        networkBlocksObserved: aggregate.networkBlocks,
        blocksFound: blocks.length,
        lastBlockAt: iso(Math.max(0, ...blocks.map(({ timestamp }) => timestamp))),
        ...outlook(aggregate.expected, coverageSeconds, windowSeconds),
        workers: workerSummaries,
      };
    });
  }

  close() {
    return this.queue(async () => { await this.loadUnlocked(); await this.flushUnlocked(true); });
  }
}

