# x86_64 Umbrel physical validation

Validation date: 29 August 2026  
Public milestone: `0.3.0`  
Public milestone commit: `88eaabb0093d487eaa1b0a0592fabf8b3d91cbb6`

Confirmed device results below were completed through milestone `0.2.6`.
Milestone `0.3.0` is published but has not yet completed the physical Settings
persistence and miner reconnection gate.

This record intentionally excludes private host addresses, wallet addresses,
credentials, secrets and raw environment data.

## Confirmed

- The NoillioN Labs Community App Store loaded on the physical x86_64 Umbrel.
- Umbrel recognized the installed Rusty Kaspad dependency.
- Kaspa Solo Mining Console built and installed successfully.
- Umbrel App Proxy served the production GUI.
- The runtime profile reported `umbrel`.
- The existing Rusty Kaspad v2.0.1 node was reachable and active.
- The packaged official Rusty Kaspa Stratum Bridge started under manager
  supervision.
- The bridge API reported active and supplied live network hashrate data.
- The dashboard showed zero connected miners and zero accepted shares without
  representative or fabricated miner data.
- Stop and restart controls worked on the physical Umbrel; restart also
  recovered a deliberately stopped bridge.
- Restarting the complete Umbrel app returned the node, manager and bridge to a
  healthy state.
- The normal Umbrel update to milestone `0.2.5` pulled the public prebuilt image
  and returned the application to a healthy state without local compilation.
- When stopped, the bridge control changed from Restart to Start; Start returned
  the managed bridge to a healthy running state.
- The bridge listener was reachable inside its container, Docker published TCP
  5555, and the Umbrel host listened on IPv4 and IPv6.
- An IceRiver KS7 Lite connected from the private LAN. The bridge reported one
  online worker, approximately 4.12 TH/s and 213 accepted shares during the
  first observation, proving the complete miner-to-bridge-to-node path.
- The ASIC observation exposed a dashboard presentation defect: the overview
  card showed network rather than miner hashrate, and the chart expected a
  history field absent from the bridge API. The source correction now derives
  combined miner hashrate and live-session history from worker readings.
- The normal Umbrel update to milestone `0.2.6` completed successfully. The
  corrected miner hashrate card displayed the KS7 Lite in TH/s and the
  live-session chart populated from bridge readings.

## Packaging findings resolved during installation

1. Removed local-only image names so Umbrel's pre-build pull step skips
   source-built services.
2. Changed build contexts to `${APP_DATA_DIR}` because Umbrel's merged Compose
   project resolves relative paths from its system Compose directory.
3. Added a scoped pre-start hook to initialize the app's persistent data
   directory for UID/GID 1000 while keeping the manager container unprivileged.

## Still pending

- Install the sanitized public `0.3.0` Settings milestone.
- Save a safe setting through the GUI, confirm the bridge passes its health
  check and the KS7 Lite reconnects.
- Restart the complete Umbrel app and confirm `/data/config.yaml` retains the
  change, the bridge returns healthy and the KS7 Lite reconnects again.
- Exercise an intentionally invalid value through the API test harness only and
  confirm validation prevents a write; do not disrupt the physical miner for a
  destructive rollback test.
- Extended ASIC stability and rejection-rate observation.
