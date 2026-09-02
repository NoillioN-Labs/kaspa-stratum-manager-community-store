import { KaspaRpcAdapter } from "../server/kaspa-rpc.mjs";

const endpoint = process.env.KASPA_NODE_GRPC || "host.docker.internal:16110";
const hash = process.env.KASPA_REWARD_TEST_BLOCK_HASH;
const rpc = new KaspaRpcAdapter({ endpoint, timeoutMs: Number(process.env.KASPA_REWARD_RPC_TIMEOUT_MS) || 5_000 });

try {
  const server = await rpc.getServerInfo();
  console.log(JSON.stringify({ endpoint, server }, null, 2));
  if (hash) {
    const reward = await rpc.getBlockRewardInfo(hash);
    const block = await rpc.getBlock(hash, true);
    console.log(JSON.stringify({ reward, block: { hash: block?.verboseData?.hash, transactionCount: block?.transactions?.length ?? 0 } }, null, 2));
  } else {
    console.log("Set KASPA_REWARD_TEST_BLOCK_HASH to also verify reward and block lookups.");
  }
} finally {
  rpc.close();
}
