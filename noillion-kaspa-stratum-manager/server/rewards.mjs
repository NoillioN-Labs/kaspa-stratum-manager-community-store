export class RewardDecodeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RewardDecodeError";
    this.code = code;
  }
}

const unsigned = (value, field) => {
  const text =
    typeof value === "string"
      ? value
      : typeof value === "bigint" || Number.isSafeInteger(value)
        ? String(value)
        : "";
  if (!/^(0|[1-9]\d*)$/.test(text))
    throw new RewardDecodeError(
      "INVALID_AMOUNT",
      `${field} must be an unsigned decimal integer.`,
    );
  return BigInt(text);
};

export const decodeCoinbaseSubsidy = (payload) => {
  let bytes;
  if (Buffer.isBuffer(payload) || payload instanceof Uint8Array)
    bytes = Buffer.from(payload);
  else if (
    typeof payload === "string" &&
    payload.length % 2 === 0 &&
    /^[0-9a-f]*$/i.test(payload)
  )
    bytes = Buffer.from(payload, "hex");
  else
    throw new RewardDecodeError(
      "INVALID_PAYLOAD",
      "Coinbase payload must be an even-length hexadecimal string or byte array.",
    );
  if (bytes.length < 16)
    throw new RewardDecodeError(
      "SHORT_PAYLOAD",
      "Coinbase payload is too short to contain its subsidy.",
    );
  return bytes.readBigUInt64LE(8);
};

export const decomposeBlockReward = ({
  hash,
  mergingHash,
  totalRewardSompi,
  queriedBlock,
  mergingBlock,
}) => {
  const normalizedHash = String(hash || "").toLowerCase();
  const total = unsigned(totalRewardSompi, "Total reward");
  if (
    !/^[a-f0-9]{64}$/.test(normalizedHash) ||
    queriedBlock?.verboseData?.hash?.toLowerCase() !== normalizedHash ||
    !mergingHash ||
    mergingBlock?.verboseData?.hash?.toLowerCase() !== mergingHash.toLowerCase()
  )
    throw new RewardDecodeError(
      "SOURCE_MISMATCH",
      "Reward block identity could not be verified.",
    );
  const queriedCoinbase = queriedBlock?.transactions?.[0];
  const mergingCoinbase = mergingBlock?.transactions?.[0];
  if (!queriedCoinbase || !mergingCoinbase)
    throw new RewardDecodeError(
      "MISSING_COINBASE",
      "Queried or merging-chain block has no coinbase transaction.",
    );
  const subsidy = decodeCoinbaseSubsidy(queriedCoinbase.payload);
  const mergeSet = Array.isArray(mergingBlock?.verboseData?.mergeSetBluesHashes)
    ? mergingBlock.verboseData.mergeSetBluesHashes
    : [];
  const index = mergeSet.findIndex(
    (candidate) => String(candidate).toLowerCase() === normalizedHash,
  );
  if (index < 0)
    throw new RewardDecodeError(
      "MERGESET_MISMATCH",
      "Queried block is not present in the merging-chain block's blue merge set.",
    );
  const bytes = Buffer.from(queriedCoinbase.payload, "hex");
  const reds = mergingBlock.verboseData.mergeSetRedsHashes ?? [];
  const outputs = mergingCoinbase.outputs ?? [];
  if (
    bytes.length < 19 ||
    bytes.length < 19 + bytes[18] ||
    new Set(mergeSet.map((h) => h.toLowerCase())).size !== mergeSet.length ||
    outputs.length !== mergeSet.length + (reds.length ? 1 : 0)
  )
    throw new RewardDecodeError(
      "AMBIGUOUS_MAPPING",
      "Skipped or ambiguous coinbase outputs prevent verified decomposition.",
    );
  const script = outputs[index]?.scriptPublicKey;
  if (
    script?.version !== bytes.readUInt16LE(16) ||
    script?.scriptPublicKey?.toLowerCase() !==
      bytes.subarray(19, 19 + bytes[18]).toString("hex")
  )
    throw new RewardDecodeError(
      "SCRIPT_MISMATCH",
      "Coinbase payout script does not match source block.",
    );
  const blueComponent = unsigned(
    mergingCoinbase.outputs?.[index]?.amount,
    "Blue reward component",
  );
  if (blueComponent < subsidy)
    throw new RewardDecodeError(
      "NEGATIVE_FEES",
      "Blue reward component is smaller than the decoded subsidy.",
    );
  if (total < blueComponent)
    throw new RewardDecodeError(
      "NEGATIVE_DAG_REWARD",
      "Total reward is smaller than the blue reward component.",
    );
  const acceptedFees = blueComponent - subsidy;
  const dagReward = total - blueComponent;
  if (subsidy + acceptedFees + dagReward !== total)
    throw new RewardDecodeError(
      "INVARIANT_FAILED",
      "Reward component arithmetic did not equal the total reward.",
    );
  return {
    subsidySompi: subsidy.toString(),
    acceptedTxFeesSompi: acceptedFees.toString(),
    dagMergeRewardSompi: dagReward.toString(),
    totalRewardSompi: total.toString(),
    rewardDecompositionVerified: true,
  };
};
