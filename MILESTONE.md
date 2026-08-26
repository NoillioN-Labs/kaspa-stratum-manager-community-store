# Kaspa Stratum Manager 0.2.3 milestone

This public snapshot was exported from validated private-development commit
`4a9d377622d787efd85c1e904562e39ea5cf0ac1` on 26 August 2026.

Windows Docker validation passed for the production `linux/amd64` image:

- production GUI returned HTTP 200;
- the bundled official Rusty Kaspa v2.0.1 bridge started;
- Rusty Kaspad connected and reported synchronized;
- bridge status and statistics APIs worked;
- Stratum TCP port 5555 operated;
- manager stop, start and restart controls passed; and
- live node/bridge data and honest zero-miner states rendered correctly.

Physical x86_64 Umbrel installation now succeeds through the Community App
Store loader. The production GUI, existing Rusty Kaspad v2.0.1 node, managed
bridge, bridge API, Umbrel runtime profile and honest zero-miner state are
healthy. Lifecycle controls, app-data persistence, LAN Stratum reachability and
an accepted-share ASIC test remain pending.

Version 0.2.1 removes local-only image names from the Compose services. Umbrel
pulls images before running local builds; without this packaging fix it tried to
download a nonexistent image and stopped at the start of installation.

Version 0.2.2 uses `${APP_DATA_DIR}` as the build context. Umbrel places its
proxy Compose file first when merging the project, which otherwise resolves a
relative context outside the copied application package and cannot find the
Dockerfile.

Version 0.2.3 adds a pre-start hook that initializes only this application's
persistent data directory for UID/GID 1000. This keeps the runtime container
unprivileged while allowing it to create and retain `config.yaml`.
