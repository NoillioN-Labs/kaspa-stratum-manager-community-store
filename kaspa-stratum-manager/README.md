# Kaspa Stratum Manager

An Umbrel-native GUI for solo mining through the Rusty Kaspa Stratum Bridge and
an existing Rusty Kaspad Umbrel node.

Start with [PROJECT_STATUS.md](PROJECT_STATUS.md) when resuming the project on a
new computer or in a new conversation.

Sessions 2–5 add the cross-platform management API, live Rusty Kaspad health,
the official pinned Rusty Kaspa v2.0.1 Stratum Bridge, process supervision,
production container packaging, honest live dashboard states and safe
persistent bridge settings.

The Settings page offers recommended Automatic and IceRiver tuning without
reading or storing wallet information, credentials, or editable node wiring.
Approved changes are validated, written atomically to `/data/config.yaml`, and
followed by a bounded bridge restart check. If the new configuration fails, the
manager restores `/data/config.last-good.yaml` and restarts the bridge again.
TCP 5555 remains protected to match the Umbrel service mapping.

On Windows, copy `.env.example` to `.env.local`, run
`npm run manager:dev`, then run `npm run dev` in a second terminal. See
[docs/WINDOWS_DEVELOPMENT.md](docs/WINDOWS_DEVELOPMENT.md) for development and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deployment design.

## Validated production image

The production `linux/amd64` image has been built successfully with Windows
Docker. Validation confirmed the bundled official bridge, HTTP 200 from the
GUI, a connected and synchronized Rusty Kaspad node, working bridge API and
statistics, TCP 5555 Stratum operation, manager lifecycle controls, live node
and bridge data, and honest zero-miner states. The detailed acceptance record is
in [docs/WINDOWS_DOCKER_VALIDATION.md](docs/WINDOWS_DOCKER_VALIDATION.md).

## Umbrel container build

The production image builds the official Rusty Kaspa Stratum Bridge from the
pinned `v2.0.1` source commit and packages it with the GUI and manager. From a
machine with Docker Buildx:

    docker buildx build --platform linux/amd64 -t kaspa-stratum-manager:0.3.0 --load .

For an ARM64 Umbrel, replace `linux/amd64` with `linux/arm64`. Do not expose TCP
5555 through an internet-facing router.

The Settings milestone still requires physical persistence and KS7 Lite
reconnection validation on the x86_64 Umbrel. Follow
[docs/UMBREL_PRIVATE_INSTALL.md](docs/UMBREL_PRIVATE_INSTALL.md); keep private
LAN addresses, wallet addresses, credentials and secrets out of Git.

## Community App Store installation

The private development repository remains the authoritative source. Sanitized
milestones are periodically exported to a separate public Umbrel Community App
Store repository. Add this URL under **App Store → Community App Stores**:

    https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store

The current public snapshot is milestone `0.2.6`, public commit
`c56619a0354b183a8804ecdbd1c6f5215703031d`. The store entry pulls a public
linux/amd64 image pinned to immutable digest `sha256:7db800d1b33d053ea4fef9060bd60e475599ad114580ab99602178b4162deb0c`. Umbrel does not need
a GitHub credential, SSH key, private LAN address or wallet address for this
installation path.

Milestone `0.2.6` has installed successfully on the physical x86_64 Umbrel.
The GUI, existing Rusty Kaspad node, managed bridge, bridge API, Umbrel runtime
profile, KS7 Lite worker hashrate, accepted shares and live-session chart are
healthy. See
[docs/UMBREL_PHYSICAL_VALIDATION.md](docs/UMBREL_PHYSICAL_VALIDATION.md) for the
remaining validation gates.

The public `0.2.6` package does not yet include the Settings milestone. A new
public version and immutable digest must be recorded here only after the
sanitized package and image pipeline pass.
