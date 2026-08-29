# Kaspa Stratum Manager — Public Milestone Status

Last updated: 29 August 2026  
Public milestone: 0.3.0

This file describes only the sanitized Community App Store milestone. Private
development history, branch metadata, local endpoints, credentials, wallet
information, miner identifiers and raw diagnostics are intentionally excluded.

## Included

- Official Rusty Kaspa v2.0.1 Stratum Bridge pinned at commit
  `cfafeb4c093fa37a303f1b9f19c58f986b870ce3`.
- Umbrel App Proxy integration and LAN Stratum TCP 5555 service.
- Live node and bridge health, lifecycle controls, worker statistics, combined
  miner hashrate and browser-local live-session history.
- Sanitized persistent bridge settings with Automatic and IceRiver presets.
- Strict type, range, port, power-of-two and ASIC-combination validation.
- Serialized atomic configuration writes with a retained last-known-good file.
- Bounded bridge restart health checks and automatic rollback.

## Automated validation

- Production web build passes.
- Manager and rendered-interface tests pass.
- ESLint and the Umbrel packaging contract pass.
- Public sensitive-data and LAN-endpoint scans pass.
- The linux/amd64 image workflow passes.

## Physical validation

Milestone 0.2.6 passed installation, updates, GUI, node and bridge health,
lifecycle controls, complete app restart, LAN Stratum TCP 5555, KS7 Lite
connection, accepted shares and live hashrate presentation on an x86_64 Umbrel.

Milestone 0.3.0 has not yet completed physical settings persistence validation.
It must be installed on the Umbrel, a safe setting saved, bridge health
confirmed, the KS7 Lite reconnected, and the complete app restarted before that
gate is marked passed.

## Remaining gaps

- Physical 0.3.0 settings persistence and miner reconnection validation.
- Extended ASIC stability and rejection-rate observation.
- Durable miner-history persistence.
- Logs page implementation.
- linux/arm64 publication and validation.
