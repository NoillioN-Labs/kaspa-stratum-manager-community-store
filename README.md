# NoillioN Labs Umbrel Community App Store

Public, sanitized milestone builds exported from private NoillioN Labs
development repositories for installation testing on umbrelOS.

## Add this store to Umbrel

Open **App Store → Community App Stores → Add** and enter:

    https://github.com/NoillioN-Labs/kaspa-stratum-manager-community-store

Then open the NoillioN Labs App Store and install **Kaspa Stratum Manager**.

## Published milestone

- App version: `0.2.5`
- Architecture tested: `linux/amd64`
- Exported private-development commit:
  `4a9d377622d787efd85c1e904562e39ea5cf0ac1`
- Official Rusty Kaspa Stratum Bridge: `v2.0.1`
- Pinned Rusty Kaspa commit:
  `cfafeb4c093fa37a303f1b9f19c58f986b870ce3`
- Prebuilt linux/amd64 image:
  `ghcr.io/noillion-labs/kaspa-stratum-manager:0.2.4`
- Immutable image digest:
  `sha256:0f1de9f237891c5dcc37187f805b5bf083f354d9a3e89748570b4e01b0916b4c`

Umbrel pulls this public, digest-pinned runtime image. It does not compile Rusty
Kaspa on the device during normal installation or updates.

The snapshot intentionally excludes private LAN addresses, wallet addresses,
credentials, secrets, Git history and untracked development files.
