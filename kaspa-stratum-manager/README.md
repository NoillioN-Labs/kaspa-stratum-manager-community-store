# Kaspa Stratum Manager

Kaspa Stratum Manager is a local-first Umbrel interface for solo mining through
the official Rusty Kaspa Stratum Bridge and the Rusty Kaspad node already
running on your Umbrel.

## What version 1.0 includes

The application is organized into five clear screens:

- **Overview** shows bridge status, combined hashrate, accepted shares, system
  health, active miners and recent performance.
- **Miners** shows each connected worker, average hashrate, confirmed blocks,
  expected blocks, seven-day probability and estimated average time to a block.
- **Logs** provides bounded, readable manager and bridge logs without requiring
  command-line access.
- **Diagnostics** checks the node, bridge API, supervisor and runtime profile
  and provides a copy-safe support summary.
- **Settings** provides recommended Automatic and IceRiver tuning, validation,
  a clear restart warning and automatic last-known-good rollback.

The manager samples mining performance once per minute and keeps a rolling
seven-day history in the Umbrel app data directory. Block attribution uses the
worker information reported by the official bridge. Forecasts are estimates
derived from locally observed miner and network performance, not promises of a
block.

## Before installing

Kaspa Stratum Manager currently supports **linux/amd64** Umbrel devices and
requires the **Rusty Kaspad** Umbrel app. Ensure the node is running and
synchronized before connecting a miner.

The miner endpoint is your Umbrel hostname or local address on TCP port
**5555**. Keep this port on your trusted LAN and do not forward it to the
internet.

## Safe configuration

The Settings screen intentionally exposes only approved bridge tuning. It does
not read, accept or store wallet information, miner passwords, credentials or
editable Kaspad service wiring. Settings are validated and written atomically.
After saving, the bridge restarts and completes a bounded health check. If the
new configuration fails, the previous known-good configuration is restored and
the bridge is restarted again.

## Local data

Mutable state is stored under the Umbrel application data directory:

- the active bridge configuration;
- a last-known-good configuration backup;
- a rolling seven-day mining history.

The history contains only the worker/instance performance, network
observations and block event identifiers required for calculations and
deduplication. The public history API does not return block hashes, wallets,
miner addresses, credentials or raw diagnostics.

## Physical validation

A physical x86_64 Umbrel installation has passed GUI access, Rusty Kaspad
connectivity, bridge supervision, bridge API and statistics, lifecycle
controls, complete app restart, prebuilt updates and LAN Stratum TCP 5555.
An IceRiver KS7 Lite has connected, reported live hashrate and submitted
accepted shares.

Automated settings persistence, rollback and seven-day history tests pass.
Physical version 1.0.0 also retains accurate seven-day history through a
complete app restart, and all five pages work correctly. Changed Settings
persistence, explicit KS7 Lite reconnection, extended ASIC
stability/rejection-rate monitoring and linux/arm64 publication are not yet
claimed.

## Support and responsible diagnostics

Use the public
[issue tracker](https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store/issues)
for reproducible problems. Never post wallet information, passwords,
credentials, private addresses, miner serial numbers or raw private
diagnostics.
