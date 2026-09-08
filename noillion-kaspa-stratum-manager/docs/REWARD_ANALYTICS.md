# Kaspa solo-mining reward analytics

## Purpose

The Analytics page follows blocks found through the local Stratum bridge from
submission to their Rusty Kaspad DAG outcome and realised mining reward.

The accounting identity is:

`block subsidy + accepted transaction fees + DAG merge rewards = total realised mining reward`

This is proof-of-work mining revenue. The app does not describe it as a
validator or staking reward, and it does not infer revenue from a submitted
block before the node resolves its DAG status.

## Runtime source and privacy

Rusty Kaspad on the same Umbrel is the authoritative source. The manager uses
the existing protected local gRPC connection and never proxies that stream to
the browser or exposes it on the LAN. Reward accounting does not require a
wallet address, private key, UTXO index, public explorer, or external API.

The implementation is pinned to the Rusty Kaspa v2.0.1 protocol definitions:

- <https://github.com/kaspanet/rusty-kaspa/blob/v2.0.1/rpc/grpc/core/proto/messages.proto>
- <https://github.com/kaspanet/rusty-kaspa/blob/v2.0.1/rpc/grpc/core/proto/rpc.proto>
- <https://github.com/kaspanet/rusty-kaspa/blob/v2.0.1/rpc/service/src/service.rs>
- <https://github.com/kaspanet/rusty-kaspa/blob/v2.0.1/docs/toccata-guide.md>

## Resolution model

- `Unknown`: merge context is not ready; the manager retains the block and retries.
- `Red`: a valid DAG block with zero direct reward.
- `Blue`: the exact total reward is taken from `GetBlockRewardInfo`.
- `Error`: a bounded local RPC or decode failure; mining supervision remains healthy and the lookup retries later.

For a blue block, exact components are derived from the queried block and its
merging-chain block. All money stays as integer sompi (`BigInt` internally and
decimal strings in JSON). Component values are published only after:

`subsidy + accepted fees + DAG reward === total reward`

If decomposition fails, the exact total remains available and the UI marks the
components incomplete.

## Persistence and API

Mining history schema v3 adds reward state to existing block records. Versions
1 and 2 migrate without dropping samples or blocks. Sample history remains a
seven-day operational window; block/reward records default to 365 days.

Read-only manager endpoints:

- `GET /api/manager/rewards/health`
- `GET /api/manager/rewards/summary?period=1h|6h|24h|7d|lifetime`
- `GET /api/manager/rewards/blocks?limit=100`

## Live compatibility gate

Automated protocol, persistence, precision, decomposition, UI, and packaging
tests pass locally. Before release, run the compatibility spike from inside the
manager image on the physical Umbrel:

```text
npm run spike:reward-rpc
```

Set `KASPA_REWARD_TEST_BLOCK_HASH` to a public known block hash to also verify
`GetBlockRewardInfo` and `GetBlock`. Record only the public hash and sanitized
results. Do not capture LAN addresses, wallets, credentials, or raw private
diagnostics.

Physical acceptance requires:

1. server info reports Rusty Kaspad v2.0.1 and the expected network;
2. a known block returns a parsed DAG colour and reward result;
3. both queried and merging-chain blocks can be fetched;
4. a locally found block progresses through pending to blue or red;
5. reward history survives manager and Umbrel restart;
6. a node restart or temporary RPC outage never interrupts bridge supervision.
