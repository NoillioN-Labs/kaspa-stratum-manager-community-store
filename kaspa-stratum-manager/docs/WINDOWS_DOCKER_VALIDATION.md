# Windows Docker production validation

Validation completed on 26 August 2026 for the production `linux/amd64` image.
This record intentionally omits private LAN addresses, wallet addresses,
credentials, secrets and machine-specific identifiers.

## Image and supply chain

- Docker successfully built the Linux AMD64 production image on Windows.
- The image bundled the official Rusty Kaspa v2.0.1 Stratum Bridge from pinned
  commit `cfafeb4c093fa37a303f1b9f19c58f986b870ce3`.
- The production entrypoint and manager launched successfully.

## Runtime acceptance results

| Check | Result |
| --- | --- |
| Production GUI | HTTP 200 |
| Rusty Kaspad connection | Connected |
| Rusty Kaspad sync state | Synchronized |
| Bridge status API | Working |
| Bridge statistics API | Working |
| Stratum TCP listener | Operating on port 5555 |
| Manager stop control | Passed |
| Manager start control | Passed |
| Manager restart control | Passed |
| Node and bridge dashboard data | Live |
| No connected miners | Honest zero-miner state; no representative records |

## Scope boundary

This validates the complete image and production service path on Windows
Docker. It does not replace installation testing through `umbreld`, persistent
app-data testing on the physical target, or an accepted-share test with an ASIC
miner.

The next acceptance run is documented in
[UMBREL_PRIVATE_INSTALL.md](UMBREL_PRIVATE_INSTALL.md).
