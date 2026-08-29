# Kaspa Stratum Manager architecture

The app runs on umbrelOS beside `rusty-kaspad`. ASIC miners connect over the
LAN to TCP 5555. The GUI is exposed through Umbrel App Proxy.

Rusty Kaspad is reached through Docker's host gateway at
`host.docker.internal:16110`. This avoids its data volume, generated container
IPs and Docker socket access. Runtime status combines manager reachability with
the official bridge's node, version, sync and statistics information.

Runtime components are the React interface, a Node.js management service and
the version-pinned Rusty Kaspa Stratum Bridge. The management service is
implemented in Node.js so it behaves consistently on Windows 11 during
development and Linux inside Umbrel. Mutable state is stored under `/data`,
mapped from `${APP_DATA_DIR}/data`.

The bridge reports worker hashrate in GH/s and network hashrate in H/s. The
overview converts worker readings to H/s, sums active workers and selects a
human-readable GH/s or TH/s unit. Because the bridge API does not provide a
historical series, the current chart is explicitly a browser-local live session
and does not claim durable 24-hour history.

## Pinned bridge supply chain

The container builds the official `kaspa-stratum-bridge` package from Rusty
Kaspa release `v2.0.1`, commit
`cfafeb4c093fa37a303f1b9f19c58f986b870ce3`, using Rust 1.91.0 and Cargo's
locked dependency graph. The build is native to the selected container target,
so the same Dockerfile supports `linux/amd64` and `linux/arm64` through Docker
Buildx. No legacy or third-party Stratum implementation is included.

## Milestone distribution

The public Community App Store package does not build this source on the Umbrel
device. GitHub Actions builds the public milestone for linux/amd64, publishes it
to GitHub Container Registry and records the registry digest. Both web and
manager services use the same public image pinned to
`sha256:bdc9298b15d246763cd7e95fc0f591a3860d359cd9193ffa37a0a5b95531a7d7`;
shared Docker layers avoid duplicate storage. The source and Dockerfile remain
public for reproducibility. Linux ARM64 remains a planned release target rather
than an advertised compatibility guarantee.

The web container forwards same-origin `/api/manager/*` requests to the
manager container over Umbrel's private application network. Only the GUI is
exposed through Umbrel App Proxy. TCP 5555 is published separately because ASIC
miners must reach the Stratum listener directly over the LAN. It must not be
forwarded by an internet-facing router.

On first start, the container copies the managed default bridge configuration
to `/data/config.yaml`. That persisted copy is retained across restarts and app
upgrades.

## Settings safety and recovery

The manager exposes a sanitized settings model rather than raw YAML. Only
variable-difficulty tuning, share rate, power-of-two clamping, extranonce size,
minimum share difficulty and the protected TCP 5555 value are represented.
The Kaspad endpoint remains controlled by Umbrel service wiring and bridge
command-line overrides; wallet information and credentials are outside the
schema and rejected as unknown fields.

Automatic and IceRiver presets use the proven IceRiver-compatible combination:
variable difficulty enabled, 30 shares per minute, power-of-two clamping,
extranonce size 2 and minimum share difficulty 2048. Custom values are checked
for type, safe range, port, power-of-two difficulty and compatible combinations.

Updates are serialized. The manager reads the current YAML, changes only the
approved keys while preserving unrelated supported configuration, writes the
current file to `/data/config.last-good.yaml`, then atomically replaces
`/data/config.yaml`. It restarts the bridge and polls its status within a fixed
deadline. A failed restart or health check atomically restores the previous
content and performs a second restart and health check. The GUI receives an
explicit saved, validation-failed or rolled-back result.

Automated persistence and rollback tests pass. Physical persistence across a
complete Umbrel app restart, followed by KS7 Lite reconnection, remains a
separate acceptance gate and is not inferred from automation.

## Development, validation and production profiles

- `windows-development`: manager runs on the Windows 11 development computer,
  uses an endpoint supplied through untracked local settings, and does not
  control a bridge process by default.
- Windows Docker production validation: the complete `linux/amd64` image runs
  locally in the `umbrel` profile against the LAN Rusty Kaspad service. This
  profile has passed GUI, bridge API, statistics, Stratum and lifecycle-control
  checks without using representative miner data.
- `umbrel`: manager and bridge run in the app container beside Rusty Kaspad;
  the manager connects through `host.docker.internal:16110` and supervises the
  packaged bridge binary. Umbrel App Proxy protects browser access and the app
  data directory retains mutable configuration.

Private addresses and credentials belong only in untracked local configuration
or an interactive shell. They are not part of the deployment contract or the
repository.
