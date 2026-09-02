import assert from "node:assert/strict";
import test from "node:test";
import { decodeCoinbaseSubsidy, decomposeBlockReward, RewardDecodeError } from "./rewards.mjs";

const payloadFor = (value) => {
  const bytes = Buffer.alloc(16);
  bytes.writeBigUInt64LE(BigInt(value), 8);
  return bytes.toString("hex");
};

test("decodes the little-endian uint64 subsidy without floating point", () => {
  assert.equal(decodeCoinbaseSubsidy(payloadFor(0)), 0n);
  assert.equal(decodeCoinbaseSubsidy(payloadFor(1)), 1n);
  assert.equal(decodeCoinbaseSubsidy(payloadFor("18446744073709551615")), 18446744073709551615n);
});

test("rejects malformed and truncated coinbase payloads", () => {
  assert.throws(() => decodeCoinbaseSubsidy("xyz"), (error) => error instanceof RewardDecodeError && error.code === "INVALID_PAYLOAD");
  assert.throws(() => decodeCoinbaseSubsidy("00".repeat(15)), (error) => error instanceof RewardDecodeError && error.code === "SHORT_PAYLOAD");
});

test("decomposes subsidy, fees, and DAG rewards by merge-set index", () => {
  const hash = "a".repeat(64);
  const result = decomposeBlockReward({
    hash,
    totalRewardSompi: "135",
    queriedBlock: { transactions:[{ payload:payloadFor(100) }] },
    mergingBlock: { verboseData:{ mergeSetBluesHashes:["b".repeat(64),hash] }, transactions:[{ outputs:[{amount:"50"},{amount:"120"}] }] },
  });
  assert.deepEqual(result, { subsidySompi:"100", acceptedTxFeesSompi:"20", dagMergeRewardSompi:"15", totalRewardSompi:"135", rewardDecompositionVerified:true });
});

test("preserves strict non-negative reward invariants", () => {
  const hash = "a".repeat(64);
  assert.throws(() => decomposeBlockReward({ hash, totalRewardSompi:"99", queriedBlock:{transactions:[{payload:payloadFor(100)}]}, mergingBlock:{verboseData:{mergeSetBluesHashes:[hash]},transactions:[{outputs:[{amount:"110"}]}]} }), /smaller/);
  assert.throws(() => decomposeBlockReward({ hash, totalRewardSompi:"120", queriedBlock:{transactions:[{payload:payloadFor(100)}]}, mergingBlock:{verboseData:{mergeSetBluesHashes:[]},transactions:[{outputs:[{amount:"110"}]}]} }), /not present/);
});
