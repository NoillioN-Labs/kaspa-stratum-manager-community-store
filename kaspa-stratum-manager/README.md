# Kaspa Stratum Manager

Kaspa Stratum Manager is a local-first Umbrel interface for solo mining through
the official Rusty Kaspa Stratum Bridge and the Rusty Kaspad node already
running on your Umbrel.

## What the application includes

The application is organized into five clear screens:

- **Overview** shows bridge status, combined hashrate, accepted shares, system
  health, active miners and selectable performance charts from ten minutes to
  seven days.
- **Miners** shows each connected worker, one-hour, six-hour, 24-hour and
  seven-day performance, share activity, confirmed blocks, expected blocks,
  observed luck, round effort and estimated average time to a block.
- **Logs** provides bounded, readable manager and bridge logs without requiring
  command-line access.
- **Diagnostics** checks the node, bridge API, supervisor and runtime profile
  and provides a copy-safe support summary.
- **Settings** provides recommended Automatic and IceRiver tuning, validation,
  a clear restart warning and automatic last-known-good rollback.

The manager samples mining performance once per minute and keeps a rolling
seven-day performance history plus a compact 90-day confirmed-block record in
the Umbrel app data directory. Block attribution uses the worker information
reported by the official bridge. Forecasts are estimates derived from locally
observed miner and network performance, not promises of a block. Round effort
may exceed 100% and is not a progress indicator.

The application is intentionally focused on solo mining. It does not collect
pool balances, payouts, fiat conversions, payment history or wallet
information. If the bridge does not provide a stale or invalid share counter,
the interface reports that the value is unavailable instead of estimating it.

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
- a rolling seven-day performance history;
- a compact 90-day confirmed-block record; and
- a rolling ten-minute dashboard series.

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

Automated settings persistence, rollback, analytics and history tests pass.
Physical version 1.0.0 also retains accurate seven-day history through a
complete app restart, and all five pages work correctly. The KS7 Lite
reconnected automatically, and saved Settings—including a deliberately changed
setting—persisted across restart. The new extended analytics and 90-day block
record require physical validation after installation; that validation is not
inferred from automated tests.

## Support and responsible diagnostics

Use the public
[issue tracker](https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store/issues)
for reproducible problems. Never post wallet information, passwords,
credentials, private addresses, miner serial numbers or raw private
diagnostics.
