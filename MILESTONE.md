# Kaspa Stratum Manager 0.3.0 milestone

This public snapshot was exported from validated private-development commit
`9b3291f656190e378c40b31d0c5615858bbec069` on 29 August 2026. The sanitized
image source is public commit `a6c130860ddfd0488552329e494a4ad4190d162b`.

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
healthy. Lifecycle controls and LAN Stratum reachability pass. An IceRiver KS7
Lite connected as one online worker and supplied accepted shares. App-data
persistence after a future Settings-page change remains pending.

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

Version 0.2.4 changes the stopped-state primary control from Restart to Start.
Physical stop/restart operation, stopped-bridge recovery and complete Umbrel app
restart recovery passed before this UI correction was published.

Version 0.2.5 replaces on-device source builds with the public linux/amd64 image
`ghcr.io/noillion-labs/kaspa-stratum-manager:0.2.4`, pinned to immutable digest
`sha256:0f1de9f237891c5dcc37187f805b5bf083f354d9a3e89748570b4e01b0916b4c`. GitHub Actions built the image from this public snapshot,
and anonymous registry access was verified before the Umbrel package changed.

The physical Umbrel then updated successfully through its normal App Store
workflow. The application remained healthy, the stopped state displayed Start,
and Start returned the managed bridge to a healthy running state.

Version 0.2.6 corrects the miner hashrate presentation exposed by the first
physical ASIC test. The overview now sums live worker readings instead of
labelling Kaspa network hashrate as miner performance, automatically scales
GH/s to TH/s and charts readings collected during the current browser session.
The linux/amd64 image is
`ghcr.io/noillion-labs/kaspa-stratum-manager:0.2.6`, pinned to immutable digest
`sha256:7db800d1b33d053ea4fef9060bd60e475599ad114580ab99602178b4162deb0c`.

The physical Umbrel update to 0.2.6 completed successfully. With the KS7 Lite
connected, the corrected combined miner hashrate displayed in TH/s and the
live-session chart populated from bridge readings.

Version 0.3.0 adds a non-technical Settings page backed by a sanitized manager
API. Automatic and IceRiver presets use the proven bridge defaults without
accepting or returning node wiring, wallets, miner passwords or credentials.
Approved changes are validated, serialized and written atomically while
preserving unrelated supported configuration. The bridge restarts and receives
a bounded health check; failure restores the last-known-good file and restarts
again.

The public linux/amd64 image is
`ghcr.io/noillion-labs/kaspa-stratum-manager:0.3.0`, pinned to immutable digest
`sha256:bdc9298b15d246763cd7e95fc0f591a3860d359cd9193ffa37a0a5b95531a7d7`.
GitHub Actions built it successfully and anonymous registry access confirmed an
OCI index containing linux/amd64.

Physical 0.3.0 persistence validation is pending. The milestone must be updated
on the Umbrel, a safe setting saved, the bridge health check observed, the KS7
Lite reconnected, and the complete app restarted before persistence is marked
passed.
