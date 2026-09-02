import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { KaspaRpcAdapter, KaspaRpcError, normalizeBlockHash } from "./kaspa-rpc.mjs";

const HASH = "A".repeat(64);

class FakeStream extends EventEmitter {
  constructor(respond) { super(); this.respond = respond; this.requests = []; }
  write(request, callback) {
    this.requests.push(request);
    callback?.();
    this.respond?.(request, this);
  }
  cancel() { this.destroyed = true; }
}

const adapterWith = (respond, timeoutMs = 100) => {
  const stream = new FakeStream(respond);
  const adapter = new KaspaRpcAdapter({
    endpoint: "local-node:16110",
    timeoutMs,
    clientFactory: () => ({ messageStream: () => stream, close() {} }),
  });
  return { adapter, stream };
};

test("normalizes and validates Kaspa block hashes", () => {
  assert.equal(normalizeBlockHash(` ${HASH} `), HASH.toLowerCase());
  assert.throws(() => normalizeBlockHash("not-a-hash"), (error) => error instanceof KaspaRpcError && error.code === "INVALID_BLOCK_HASH");
});

test("correlates streamed server-info responses by request id", async () => {
  const { adapter, stream } = adapterWith((request, target) => queueMicrotask(() => target.emit("data", {
    id: request.id,
    getServerInfoResponse: { serverVersion: "2.0.1", networkId: "mainnet", isSynced: true, hasUtxoIndex: false, virtualDaaScore: "123" },
  })));
  assert.deepEqual(await adapter.getServerInfo(), {
    rpcApiVersion: undefined,
    rpcApiRevision: undefined,
    serverVersion: "2.0.1",
    networkId: "mainnet",
    hasUtxoIndex: false,
    isSynced: true,
    virtualDaaScore: "123",
  });
  assert.deepEqual(stream.requests[0], { id: "1", getServerInfoRequest: {} });
  adapter.close();
});

test("preserves uint64 reward values as decimal strings", async () => {
  const { adapter } = adapterWith((request, target) => queueMicrotask(() => target.emit("data", {
    id: request.id,
    getBlockRewardInfoResponse: {
      blockColor: "BLUE",
      confirmationCount: "42",
      mergingChainBlockHash: "B".repeat(64),
      rewardAmount: "18446744073709551615",
    },
  })));
  const result = await adapter.getBlockRewardInfo(HASH);
  assert.equal(result.hash, HASH.toLowerCase());
  assert.equal(result.blockColor, "blue");
  assert.equal(result.rewardAmountSompi, "18446744073709551615");
  assert.equal(result.mergingChainBlockHash, "b".repeat(64));
  adapter.close();
});

test("times out bounded requests without leaving pending entries", async () => {
  const { adapter } = adapterWith(null, 10);
  await assert.rejects(adapter.getServerInfo(), (error) => error instanceof KaspaRpcError && error.code === "TIMEOUT");
  assert.equal(adapter.pending.size, 0);
  adapter.close();
});
