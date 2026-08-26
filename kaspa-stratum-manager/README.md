# Kaspa Stratum Manager

An Umbrel-native GUI for solo mining through the Rusty Kaspa Stratum Bridge and
an existing Rusty Kaspad Umbrel node.

Start with [PROJECT_STATUS.md](PROJECT_STATUS.md) when resuming the project on a
new computer or in a new conversation.

Sessions 2–3 add the cross-platform management API, live Rusty Kaspad health,
the official pinned Rusty Kaspa v2.0.1 Stratum Bridge, process supervision,
production container packaging and honest live dashboard states.

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

    docker buildx build --platform linux/amd64 -t kaspa-stratum-manager:0.2.0 --load .

For an ARM64 Umbrel, replace `linux/amd64` with `linux/arm64`. Do not expose TCP
5555 through an internet-facing router.

The next milestone is the private installation on an x86_64 Umbrel computer
beside Rusty Kaspad. Follow
[docs/UMBREL_PRIVATE_INSTALL.md](docs/UMBREL_PRIVATE_INSTALL.md); keep private
LAN addresses, wallet addresses, credentials and secrets out of Git.
