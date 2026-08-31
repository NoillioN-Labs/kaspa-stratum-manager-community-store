import { readFile } from "node:fs/promises";
import { atomicWrite } from "./settings.mjs";

export const TEN_MINUTES_MS = 10 * 60 * 1000;

const finite = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const optionalFinite = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;
const iso = (timestamp) => timestamp ? new Date(timestamp).toISOString() : null;
const emptyData = () => ({ version: 1, acceptedSharesTotal: 0, lastBridgeShares: null, samples: [] });

const validStoredData = (input) => {
  if (!input || input.version !== 1 || !Array.isArray(input.samples)) return emptyData();
  return {
    version: 1,
    acceptedSharesTotal: finite(input.acceptedSharesTotal),
    lastBridgeShares: optionalFinite(input.lastBridgeShares),
    samples: input.samples.flatMap((sample) => Number.isFinite(sample?.timestamp) ? [{
      timestamp: sample.timestamp,
      hashrateHs: finite(sample.hashrateHs),
      connectedMiners: Math.floor(finite(sample.connectedMiners)),
      acceptedSharesTotal: finite(sample.acceptedSharesTotal),
    }] : []),
  };
};

const combinedHashrate = (stats) => (Array.isArray(stats?.workers) ? stats.workers : [])
  .reduce((total, worker) => total + finite(worker?.hashrateGhs ?? worker?.hashrate) * 1e9, 0);

export class DashboardMetricsStore {
  constructor({
    path,
    retentionMs = TEN_MINUTES_MS,
    sampleIntervalMs = 5_000,
    flushIntervalMs = 30_000,
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
      if (error.code !== "ENOENT") this.onError(`Dashboard metrics could not be read and were reset: ${error.message}`);
      this.data = emptyData();
    }
    this.loaded = true;
    this.pruneUnlocked(this.now());
  }

  pruneUnlocked(now) {
    const cutoff = now - this.retentionMs;
    this.data.samples = this.data.samples.filter(({ timestamp }) => timestamp >= cutoff && timestamp <= now + this.sampleIntervalMs);
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
      const bridgeShares = optionalFinite(stats?.totalShares);
      if (bridgeShares !== null) {
        if (this.data.lastBridgeShares === null) this.data.acceptedSharesTotal = Math.max(this.data.acceptedSharesTotal, bridgeShares);
        else this.data.acceptedSharesTotal += bridgeShares >= this.data.lastBridgeShares
          ? bridgeShares - this.data.lastBridgeShares
          : bridgeShares;
        this.data.lastBridgeShares = bridgeShares;
      }
      const workers = Array.isArray(stats?.workers) ? stats.workers : [];
      const sample = {
        timestamp,
        hashrateHs: combinedHashrate(stats),
        connectedMiners: Math.floor(optionalFinite(stats?.activeWorkers) ?? workers.length),
        acceptedSharesTotal: this.data.acceptedSharesTotal,
      };
      const latest = this.data.samples.at(-1);
      if (latest && timestamp - latest.timestamp < this.sampleIntervalMs / 2) this.data.samples[this.data.samples.length - 1] = sample;
      else this.data.samples.push(sample);
      this.pruneUnlocked(timestamp);
      this.dirty = true;
      await this.flushUnlocked();
    });
  }

  summary() {
    return this.queue(async () => {
      await this.loadUnlocked();
      this.pruneUnlocked(this.now());
      return {
        retentionMinutes: this.retentionMs / 60_000,
        sampleIntervalSeconds: this.sampleIntervalMs / 1000,
        acceptedSharesTotal: this.data.acceptedSharesTotal,
        startedAt: iso(this.data.samples[0]?.timestamp),
        lastSampleAt: iso(this.data.samples.at(-1)?.timestamp),
        samples: this.data.samples.map((sample) => ({ ...sample })),
      };
    });
  }

  reset() {
    return this.queue(async () => {
      await this.loadUnlocked();
      const lastBridgeShares = this.data.lastBridgeShares;
      this.data = { ...emptyData(), lastBridgeShares };
      this.dirty = true;
      await this.flushUnlocked(true);
    });
  }

  close() {
    return this.queue(async () => { await this.loadUnlocked(); await this.flushUnlocked(true); });
  }
}
