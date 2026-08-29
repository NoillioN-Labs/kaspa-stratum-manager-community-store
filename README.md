# NoillioN Labs Umbrel Community App Store

Public, sanitized milestone builds exported from private NoillioN Labs
development repositories for installation testing on umbrelOS.

## Add this store to Umbrel

Open **App Store → Community App Stores → Add** and enter:

    https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store

Then open the NoillioN Labs App Store and install **Kaspa Stratum Manager**.

## Published milestone

- App version: `0.3.0`
- Architecture tested: `linux/amd64`
- Exported private-development commit:
  `9b3291f656190e378c40b31d0c5615858bbec069`
- Official Rusty Kaspa Stratum Bridge: `v2.0.1`
- Pinned Rusty Kaspa commit:
  `cfafeb4c093fa37a303f1b9f19c58f986b870ce3`
- Prebuilt linux/amd64 image:
  `ghcr.io/noillion-labs/kaspa-stratum-manager:0.3.0`
- Immutable image digest:
  `sha256:bdc9298b15d246763cd7e95fc0f591a3860d359cd9193ffa37a0a5b95531a7d7`

Umbrel pulls this public, digest-pinned runtime image. It does not compile Rusty
Kaspa on the device during normal installation or updates.

Version 0.3.0 adds sanitized persistent bridge settings, Automatic and
IceRiver presets, strict validation, atomic writes, bounded restart checks and
automatic last-known-good rollback. Automated validation and the linux/amd64
image build pass. Physical settings persistence and KS7 Lite reconnection
remain pending and are not claimed by this release record.

The snapshot intentionally excludes private LAN addresses, wallet addresses,
credentials, secrets, Git history and untracked development files.

## Development delivery workflows

Routine physical testing uses the manual **Fast Push - Umbrel Test** workflow,
which rebuilds only the application layer on top of the last verified bridge
image and automatically publishes the next Umbrel patch package. Major
milestones use **Slow Push - Full Release**, which retains the complete build,
test, lint, packaging, Rust compilation, provenance and immutable-release
gates. See
[Fast Push and Slow Push](kaspa-stratum-manager/docs/RELEASE_WORKFLOWS.md).
