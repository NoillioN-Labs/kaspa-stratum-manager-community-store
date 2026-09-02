# NoillioN Labs Umbrel Community App Store

This community store publishes **Kaspa Solo Mining Console**, a local-first
Umbrel application for running, managing and understanding Kaspa solo mining
through the official Rusty Kaspa Stratum Bridge and an existing Rusty Kaspad
node.

## What the app provides

- live node, bridge, miner, hashrate and accepted-share monitoring;
- miner performance windows, availability, share freshness and responsive charts;
- confirmed-block attribution, block luck, round effort and seven-day outlooks;
- local DAG-resolution and realised-reward analytics using exact integer values;
- persistent local mining, dashboard and reward history while the browser is closed;
- safe Automatic and IceRiver bridge presets with validation and rollback;
- bridge lifecycle controls, bounded logs and guided diagnostics;
- persistent Light and Dark themes; and
- LAN connection guidance for the intentional Stratum TCP 5555 endpoint.

All probability and average-time figures are statistical estimates based on
locally observed performance and network conditions. They are not guarantees.

## Install the community store

1. In Umbrel, open **App Store → Community App Stores → Add**.
2. Enter:

       https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store

3. Open the **NoillioN Labs** store and install **Kaspa Solo Mining Console**.

The official **Rusty Kaspad** Umbrel app must be installed, running and
synchronized. Keep miners on the same trusted local network and do not expose
Stratum TCP 5555 through an internet-facing router.

## Privacy and security

The interface runs behind Umbrel App Proxy. It does not read, accept or store
wallet addresses, miner passwords, credentials or editable Kaspad wiring.
Mining history remains in the app's local data directory and excludes miner IP
addresses, wallets, credentials and raw diagnostics. Runtime LAN discovery is
used only to present a connection address and is not persisted or logged.

Release images are built from this sanitized public source, published for
linux/amd64 and linux/arm64, and pinned in the app package by immutable digest.
Automated validation does not imply physical ARM64 umbrelOS testing or official
Umbrel approval.

## Validation status

Earlier Community releases passed physical x86_64 Umbrel testing beside Rusty
Kaspad v2.0.1, including GUI access, miner connectivity, accepted shares,
settings and history persistence, full Umbrel restart and IceRiver KS7 Lite
reconnection. Each new release candidate requires its own regression pass.

## Support

Report reproducible problems through the public
[issue tracker](https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store/issues).
Remove private addresses, wallet information, credentials, miner identifiers
and other sensitive data before sharing diagnostics.
