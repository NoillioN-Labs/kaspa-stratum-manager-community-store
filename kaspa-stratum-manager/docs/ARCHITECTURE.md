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

## Pinned bridge supply chain

The container builds the official `kaspa-stratum-bridge` package from Rusty
Kaspa release `v2.0.1`, commit
`cfafeb4c093fa37a303f1b9f19c58f986b870ce3`, using Rust 1.91.0 and Cargo's
locked dependency graph. The build is native to the selected container target,
so the same Dockerfile supports `linux/amd64` and `linux/arm64` through Docker
Buildx. No legacy or third-party Stratum implementation is included.

The web container forwards same-origin `/api/manager/*` requests to the
manager container over Umbrel's private application network. Only the GUI is
exposed through Umbrel App Proxy. TCP 5555 is published separately because ASIC
miners must reach the Stratum listener directly over the LAN. It must not be
forwarded by an internet-facing router.

On first start, the container copies the managed default bridge configuration
to `/data/config.yaml`. That persisted copy is retained across restarts and app
upgrades. The private Umbrel installation must verify this persistence before
an ASIC is connected.

## Development, validation and production profiles

- `windows-development`: manager runs on the Windows 11 development computer,
  connects to `umbrel.local:16110`, and does not control a bridge process by
  default.
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
