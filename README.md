# NoillioN Labs Umbrel Community App Store

This community store publishes **Kaspa Stratum Manager**, a local-first Umbrel
application for running and monitoring the official Rusty Kaspa Stratum Bridge
beside an existing Rusty Kaspad node.

## Current verified release

- Version: `1.0.0`
- Image: `ghcr.io/noillion-labs/kaspa-stratum-manager:1.0.0`
- Immutable digest:
  `sha256:3252533fef8a2e0ac360a8348b09c0ddb673b1f18dfec97b80bd04af03bb408f`
- Sanitized release source:
  [`204e3e78f10e011265986a06d9cb76d4dc439946`](https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store/commit/204e3e78f10e011265986a06d9cb76d4dc439946)
- Immutable package pin:
  [`ba351487ba277967fc03361239d88737b20584c1`](https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store/commit/ba351487ba277967fc03361239d88737b20584c1)
- Full Slow Push:
  [successful workflow run](https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store/actions/runs/33290604187)

The registry image is publicly readable and the package pins both Umbrel services
to the same immutable digest.

## Install the community store

1. In Umbrel, open **App Store → Community App Stores → Add**.
2. Enter:

       https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store

3. Open the **NoillioN Labs** store and install **Kaspa Stratum Manager**.

## Kaspa Stratum Manager 1.0

Version 1.0 provides a non-technical interface for Kaspa solo-mining operations:

- live node, bridge, miner, hashrate and accepted-share status;
- miner-level performance, confirmed-block attribution and seven-day outlooks;
- a privacy-limited seven-day local history that continues while the GUI is closed;
- bounded bridge and manager logs;
- guided diagnostics with copy-safe summaries;
- Automatic and IceRiver bridge presets with strict validation;
- atomic settings writes, restart health checks and automatic rollback;
- bridge lifecycle controls and a fixed LAN Stratum listener on TCP 5555.

The probability and average-time figures are statistical estimates based on
observed hashrate and network conditions. They are not guarantees.

## Requirements

- an x86_64 Umbrel device;
- the **Rusty Kaspad** Umbrel app installed, running and synchronized;
- a supported ASIC miner on the same trusted local network.

Connect miners to your Umbrel device on Stratum TCP port **5555**. Do not expose
that port through an internet-facing router.

## Privacy and security

Kaspa Stratum Manager is designed for local use behind Umbrel App Proxy. Its
Settings interface does not read, accept or store wallet information, miner
passwords, credentials or editable Kaspad wiring. History is stored locally
under the app data directory and excludes miner IP addresses, wallets,
credentials and raw diagnostics.

The distributed runtime is a public linux/amd64 container image pinned by an
immutable digest in the app package. Major releases are built from sanitized
public source after production build, automated test, lint, packaging and
sensitive-data checks. The release process also generates provenance and an
SBOM.

## Validation status

The application has been installed on a physical x86_64 Umbrel beside Rusty
Kaspad v2.0.1. The GUI, bridge API, node connection, lifecycle controls, full
app restart, prebuilt updates and LAN Stratum connection have been exercised.
An IceRiver KS7 Lite connected successfully, reported live hashrate and
submitted accepted shares.

Automated persistence, rollback and history tests pass. Extended ASIC
stability/rejection-rate observation, physical seven-day history persistence
verification and linux/arm64 publication remain future validation work.

## Support

Report reproducible problems through the public
[issue tracker](https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store/issues).
Before sharing diagnostics, remove private addresses, wallet information,
credentials, miner identifiers and any other sensitive data.

## Release workflow

Minor Umbrel test builds use **Fast Push**. Major public milestones use
**Slow Push**, which performs the complete application and Rust bridge build,
validation, provenance, SBOM, publication and immutable package pinning. See
[Fast Push and Slow Push](kaspa-stratum-manager/docs/RELEASE_WORKFLOWS.md).
