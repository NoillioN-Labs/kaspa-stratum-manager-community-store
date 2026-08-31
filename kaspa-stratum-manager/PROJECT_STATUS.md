# Kaspa Stratum Manager — Project Status

Last updated: 29 August 2026  
Status version: 0.9
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
- Development node endpoint is supplied through untracked local configuration.
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
- Public milestone store:
  https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store

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
11. Use Fast Push for minor application testing and Slow Push for full release
    milestones; never run the full Rust release build automatically on an
    ordinary source commit.

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

### Session 4 — Public milestone distribution

- Kept the authoritative development repository private.
- Created a separate public Umbrel Community App Store repository containing a
  sanitized snapshot of milestone `0.2.0`.
- Published public milestone `0.2.6` at commit
  `c56619a0354b183a8804ecdbd1c6f5215703031d`.
- Configured the public store entry to build locally on the Umbrel computer and
  depend on the installed `rusty-kaspad` app.
- Re-ran packaging, manager, and sensitive-data checks before publication.
- Diagnosed the first Umbrel install attempt stopping at 1%: Umbrel's required
  pre-build pull tried to download the named local-only image. Removed those
  image names so the pull skips the build-only services and `up --build` can
  build them locally.
- Diagnosed the second install attempt from sanitized device logs: Umbrel's
  merged Compose project resolved relative build contexts from its system
  directory. Changed both contexts to `${APP_DATA_DIR}` so the copied package's
  Dockerfile is found.
- Completed the first physical installation and confirmed the GUI and App Proxy
  start. The manager initially restarted because the bind-mounted data directory
  was root-owned; added a scoped pre-start ownership hook so the runtime remains
  unprivileged as UID/GID 1000.
- Updated to public milestone `0.2.3` and confirmed a healthy physical Umbrel
  dashboard: existing Rusty Kaspad v2.0.1 active, managed bridge running, bridge
  API active, Umbrel runtime profile active, live network hashrate, zero miners
  and zero accepted shares.
- Confirmed physical stop and restart controls, recovery of a stopped bridge,
  and full Umbrel app restart recovery. Corrected the stopped-state primary
  action so it is explicitly labelled Start instead of Restart.
- Added a public GitHub Actions image pipeline, successfully built linux/amd64,
  verified anonymous registry access and pinned digest
  `sha256:0f1de9f237891c5dcc37187f805b5bf083f354d9a3e89748570b4e01b0916b4c` in the Umbrel package.
- Replaced on-device source builds with the prebuilt image so normal Umbrel
  updates can deliver application source changes.
- Updated the physical Umbrel to milestone `0.2.5` through the normal update
  path and confirmed the prebuilt image remains healthy.
- Confirmed the stopped bridge displays an explicit Start action and that Start
  returns the managed bridge to a healthy running state.
- Confirmed the manager container, Docker host publication and Umbrel host all
  listen on Stratum TCP 5555, then connected an IceRiver KS7 Lite over the
  private LAN. The bridge reported one online worker, approximately 4.12 TH/s
  and 213 accepted shares during the first observation.
- Corrected the dashboard to distinguish combined miner hashrate from Kaspa
  network hashrate, scale worker units automatically and build a live-session
  chart from the bridge's five-second worker readings.
- Published the corrected linux/amd64 image as `0.2.6`, verified anonymous
  registry access and pinned immutable digest
  `sha256:7db800d1b33d053ea4fef9060bd60e475599ad114580ab99602178b4162deb0c`.
- Updated the physical Umbrel to milestone `0.2.6` and confirmed the combined
  miner hashrate display, automatic TH/s scaling and live-session chart work
  with the connected KS7 Lite.

### Session 5 — Safe persistent bridge settings

- Added a strict sanitized settings model containing only approved bridge
  tuning; it never accepts or returns node wiring, wallets, passwords or
  credentials.
- Added recommended Automatic and curated IceRiver presets using the physically
  proven values: variable difficulty, 30 shares per minute, power-of-two
  clamping, extranonce size 2 and minimum share difficulty 2048.
- Kept the Umbrel node endpoint and fixed LAN Stratum port protected from casual
  editing.
- Added type, range, port, power-of-two and ASIC-combination validation.
- Added serialized, atomic `/data/config.yaml` writes that preserve unrelated
  supported YAML and retain `/data/config.last-good.yaml`.
- Added bridge restart and bounded health checks after save, with automatic
  configuration restoration and a second restart when new settings fail.
- Implemented a non-technical Settings page with explanations, validation
  results, explicit interruption warning and **Save and restart bridge** action.
- Added manager coverage for sanitized reads, validation, persistence,
  concurrent updates, restart success, restart failure and rollback, plus
  rendered-interface and packaging assertions.
- Published sanitized public milestone `0.3.0` at commit
  `88eaabb0093d487eaa1b0a0592fabf8b3d91cbb6` with the linux/amd64 image built
  from public source commit `a6c130860ddfd0488552329e494a4ad4190d162b`.
- Verified anonymous registry access and pinned immutable digest
  `sha256:bdc9298b15d246763cd7e95fc0f591a3860d359cd9193ffa37a0a5b95531a7d7`.
- Split public delivery into manual Fast Push and Slow Push workflows. Fast
  Push reuses the immutable release bridge and rebuilds only the application;
  Slow Push retains all validation, Rust compilation and release metadata. The
  active public workflow definitions are recorded at commit
  `f29ec110e9aedb689aef37b41f843dbada2269a3`.

### Session 6 — Durable mining history and block outlook

- Confirmed the official bridge attributes confirmed-blue blocks to individual
  workers through `/api/stats`; Kaspad validates blocks but does not retain the
  originating Stratum worker identity.
- Added manager-owned one-minute history sampling that runs while the GUI is
  closed and retains a rolling seven-day window in
  `/data/mining-history.json`.
- Persisted only worker/instance performance, network observations and block
  event identifiers needed for deduplication. Wallets, miner IPs, credentials
  and raw diagnostics are excluded, and block hashes are not returned by the
  sanitized history API.
- Added atomic bounded writes, immediate confirmed-block persistence, restart
  reload, event deduplication and retention pruning.
- Added combined and per-worker average hashrate, confirmed blocks, last-block
  time, expected blocks, seven-day probability and estimated average wait on
  the Miners screen.
- Added history calculation, persistence, sanitization, API, rendered-interface
  and packaging tests.

### Session 7 — Persistent live dashboard metrics

- Moved the ten-minute Overview hashrate series into the always-running manager
  service so browser refreshes and restarts do not reset the chart.
- Added bounded atomic storage and a cumulative accepted-share total without
  changing truthful current-session bridge uptime.

### Session 8 — Solo-mining performance analytics

- Added one-hour, six-hour, 24-hour and seven-day performance windows with
  responsive downsampled charts.
- Added accepted-share freshness/rate, availability, optional share-quality
  reporting, actual-versus-expected blocks, observed luck and round effort.
- Retained compact confirmed-block events for 90 days without exposing hashes,
  wallet information, miner addresses or raw diagnostics.
- Optimized Overview and Miners layouts for narrow mobile screens.
- Kept the feature strictly focused on solo mining; pool balances, payouts,
  payment records and fiat conversions are not collected.

## Validation status

The production dashboard build, ESLint, manager tests, settings persistence and
rollback tests, statistics proxy test, unmanaged-profile safety test, rendered
interface tests and static Umbrel packaging validation pass.

The Windows Docker production-profile validation also passes for linux/amd64.
See [docs/WINDOWS_DOCKER_VALIDATION.md](docs/WINDOWS_DOCKER_VALIDATION.md) for
the recorded scope and privacy-safe acceptance results.

The application is installed and healthy on the physical x86_64 Umbrel through
the Community App Store loader. See
[docs/UMBREL_PHYSICAL_VALIDATION.md](docs/UMBREL_PHYSICAL_VALIDATION.md) for the
privacy-safe pass/pending record.

## Immediate next action

Install public milestone `0.3.0`, then validate settings persistence on the
physical Umbrel through a complete app restart with the KS7 Lite reconnecting.
Do not mark that physical gate as passed until the device test is complete.

## Next planned implementation

1. Physically verify settings survive a full
   Umbrel app restart with the KS7 Lite reconnecting.
2. Observe extended ASIC stability and rejection rate without recording private
   miner details.
3. Physically verify seven-day history survives a complete Umbrel app restart
   and continues sampling with the KS7 Lite reconnected.
4. Extend the digest-pinned image from linux/amd64 to linux/arm64 before wider
   distribution.

## Known gaps

- Automated persistent bridge configuration, restart checks and rollback pass;
  physical persistence and KS7 Lite reconnection validation remain pending.
- The public milestone has an immutable linux/amd64 image; linux/arm64 remains
  unpublished and unvalidated.
- Durable seven-day miner and confirmed-block history is implemented and passes
  automated restart/reload, retention, calculation and privacy tests. Physical
  Umbrel persistence and continued KS7 Lite sampling remain unvalidated.
- The Logs and Diagnostics screens are implemented; logs remain bounded and
  in-memory by design until durable local history is added.
- The first KS7 Lite test passes connection and accepted-share gates; extended
  stability and rejection-rate observation remain pending.
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

