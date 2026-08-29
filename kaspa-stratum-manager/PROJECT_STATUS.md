# Kaspa Stratum Manager — Project Status

Last updated: 29 August 2026  
Status version: 0.8
Repository: https://github.com/NoillioN-Labs/kaspa-stratum-manager

## Purpose

Kaspa Stratum Manager is an Umbrel-native web application for configuring,
running and monitoring the Rusty Kaspa Stratum Bridge beside the existing
Rusty Kaspad Umbrel app.

The application will let an Umbrel owner configure the bridge without
command-line administration, control its lifecycle, inspect logs and
diagnostics, monitor miners, and retain useful statistics.

## Deployment topology

- Development computer: Windows 11.
- Production computer: a separate x86_64 Umbrel computer on the same LAN.
- Kaspa node: the official rusty-kaspad Umbrel app.
- Development node endpoint: `umbrel.local:16110`, with a private LAN address
  used only in untracked local configuration when mDNS is unavailable.
- Production node endpoint: `host.docker.internal:16110`.
- Miner endpoint: `stratum+tcp://<umbrel-lan-address>:5555`.

The Windows profile does not control a bridge process unless a local bridge
executable is explicitly configured. The Umbrel profile supervises the bridge
binary packaged with the application.

## Authoritative source

GitHub is the durable source of truth. Local workspaces are replaceable and
must not be treated as the only copy.

- Stable branch: `main`
- Current branch: `session-2-management-api`
- Current review: https://github.com/NoillioN-Labs/kaspa-stratum-manager/pull/1

Never commit private LAN addresses, wallet addresses, wallet seeds, private
keys, GitHub credentials or other secrets.

## Approved technical decisions

1. Run the finished application on Umbrel beside Rusty Kaspad.
2. Use the current Rusty Kaspa in-repository Stratum Bridge, not the legacy Go
   bridge.
3. Run the bridge in external node mode against the existing Umbrel node.
4. Consume the bridge's native `/api/status` and `/api/stats` endpoints.
5. Use a Node.js manager for consistent Windows and Linux behaviour.
6. Do not mount the Docker socket.
7. Store mutable state under the Umbrel application data directory.
8. Protect the GUI with Umbrel App Proxy.
9. Expose TCP 5555 to the LAN, but not the internet, by default.
10. Target linux/amd64 and linux/arm64 release images.

## Completed work

### Session 1 — Foundation

- Responsive Kaspa-themed dashboard.
- Umbrel manifest and Docker Compose skeleton.
- Rusty Kaspad dependency and local gRPC connection contract.
- Persistent-data and security boundaries.
- GitHub repository and main baseline.

### Session 2 — Management and diagnostics

- Cross-platform Node.js management service.
- Rusty Kaspad TCP reachability and latency checks.
- Rusty Bridge status and statistics API integration.
- Start, stop and restart process-supervision interface.
- Bounded manager and bridge logs.
- Safe unmanaged Windows development mode.
- Live dashboard health state and diagnostics screen.
- Windows development instructions.
- Automated manager, rendering, build and lint validation.
- Live Windows-to-Umbrel Rusty Kaspad connection confirmed on the private LAN.
- Honest dashboard empty states: representative mining rows and hashrate
  graphics are never presented as live data.

### Session 3 — Official bridge packaging and Windows Docker validation

- Pinned official Rusty Kaspa release `v2.0.1` at commit
  `cfafeb4c093fa37a303f1b9f19c58f986b870ce3`.
- Added a source-built Rust 1.91 container stage for the official
  `kaspa-stratum-bridge` binary.
- Added a shared application image targeting linux/amd64 and linux/arm64.
- Added persistent first-run bridge configuration at `/data/config.yaml`.
- Moved the LAN Stratum port to the manager/bridge container.
- Added same-origin GUI routing to the internal manager service so the API
  remains behind Umbrel App Proxy.
- Added automated packaging-contract validation.
- Successfully built the production `linux/amd64` image on Windows Docker.
- Confirmed the image contains the official pinned Rusty Kaspa v2.0.1 Stratum
  Bridge.
- Confirmed the production GUI returns HTTP 200.
- Confirmed Rusty Kaspad connects and reports synchronized.
- Confirmed the bridge API and live statistics operate.
- Confirmed the Stratum listener accepts connections on TCP 5555.
- Confirmed manager stop, start and restart controls work.
- Confirmed the production GUI displays live node and bridge information and
  honest zero-miner states.

## Validation status

The production dashboard build, ESLint, manager tests, statistics proxy test,
unmanaged-profile safety test, rendered metadata test and static Umbrel
packaging validation pass.

The Windows Docker production-profile validation also passes for linux/amd64.
See [docs/WINDOWS_DOCKER_VALIDATION.md](docs/WINDOWS_DOCKER_VALIDATION.md) for
the recorded scope and privacy-safe acceptance results.

Public milestone `0.2.6` is installed and healthy on the physical x86_64
Umbrel. Rusty Kaspad v2.0.1, the managed bridge, lifecycle controls, LAN
Stratum TCP 5555, one IceRiver KS7 Lite worker, accepted shares, combined miner
hashrate and the live-session chart pass. No password, private address or wallet
address is stored in this repository.

## Immediate next action

Develop and validate persistent Settings-page changes using the proven
IceRiver-compatible defaults, including safe bridge restart and rollback.

## Next planned implementation

1. Define validated Automatic and IceRiver bridge-setting presets.
2. Add atomic `/data/config.yaml` persistence and a last-known-good backup.
3. Add bounded restart health checks and automatic rollback.
4. Implement the Settings page and automated tests.
5. Physically verify persistence and KS7 Lite reconnection on Umbrel.
6. Publish the next immutable linux/amd64 milestone.
7. Add linux/arm64 before wider distribution.

## Known gaps

- Persistent bridge configuration through the future Settings page remains
  pending; LAN Stratum and accepted-share ASIC checks pass.
- Linux ARM64 remains unpublished and unvalidated.
- Durable miner history is not implemented; the current chart is browser-local.
- Logs and settings screens are incomplete.
- Extended ASIC stability and rejection-rate observation remain pending.
- Main contains Session 1 until Pull Request #1 is merged.

## Resume on another computer

    cd C:\KaspaDev
    git clone https://github.com/NoillioN-Labs/kaspa-stratum-manager.git
    cd kaspa-stratum-manager
    git switch session-2-management-api
    npm ci
    Copy-Item .env.example .env.local

Then follow `docs/WINDOWS_DEVELOPMENT.md` for development or
`docs/UMBREL_PRIVATE_INSTALL.md` for the private Umbrel milestone.

## Standard continuation prompt

> Continue development of Kaspa Stratum Manager from
> NoillioN-Labs/kaspa-stratum-manager. Read PROJECT_STATUS.md, README.md,
> docs/ARCHITECTURE.md and docs/UMBREL_PRIVATE_INSTALL.md; inspect the current
> branches and open pull requests; verify the latest tests; then continue from
> the immediate next action without restarting the project design.

## Maintenance rule

Update this document whenever a session changes the milestone, architecture,
decisions, validation status, known gaps or next action. Every completed
session must leave the repository resumable without a previous chat transcript.

