# Kaspa Stratum Manager — Project Status

Last updated: 26 August 2026  
Status version: 0.5
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

The application has not yet been installed through umbreld on the physical
Umbrel computer. The host is reachable from the development computer, but this
session does not have non-interactive SSH authorization; no password or private
address has been stored.

## Immediate next action

Authenticate interactively to the x86_64 Umbrel computer, copy the private app
package into its local app store, install it with `umbreld`, and run the
post-install checks in [docs/UMBREL_PRIVATE_INSTALL.md](docs/UMBREL_PRIVATE_INSTALL.md).

## Next planned implementation

1. Confirm the target reports `x86_64` and Rusty Kaspad is installed and synced.
2. Copy the private app package to the target without copying `.git`, `.env*`,
   build output, credentials or other local-only files.
3. Install the app with `umbreld client apps.install.mutate`.
4. Confirm the manager starts the packaged official bridge and survives an app
   restart with `/data/config.yaml` intact.
5. Validate the live `/api/stats` payload and honest zero-miner mapping.
6. Connect one ASIC miner and test accepted shares, controls and persistence.
7. Record an immutable multi-architecture image digest before wider
   distribution.

## Known gaps

- The first physical Umbrel private installation is waiting for interactive
  device authentication.
- Final published multi-architecture image digests are not yet available.
- A community-app-store wrapper will be created after the private installation;
  the current Compose build is for private validation.
- Miner history persistence is not implemented.
- Logs and settings screens are incomplete.
- ASIC testing has not started.
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
