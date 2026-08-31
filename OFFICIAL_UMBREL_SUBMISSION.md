# Kaspa Stratum Manager — Official Umbrel App Store Submission

Status: Preparation in progress

Target repository: `getumbrel/umbrel-apps`
Target app ID: `kaspa-stratum-manager`
Current community package version: `1.0.4`

## Objective

Prepare Kaspa Stratum Manager for submission to the Official Umbrel App Store while preserving the existing Community App Store release path.

## Current strengths

- Working browser-based Umbrel UI.
- Existing Community App Store package is live and deployable.
- Uses Umbrel `app_proxy` for the web UI.
- Depends on official Umbrel app `rusty-kaspad`.
- Persists application data under `${APP_DATA_DIR}/data`.
- Docker images are pinned by digest in the Umbrel package.
- No Docker socket mount.
- No `privileged: true`.
- No host networking.
- Stratum miner port is explicitly published as TCP 5555.
- Current package has health checks for both web and manager services.

## Official Umbrel App Store requirements to resolve

### 1. Multi-architecture images — BLOCKER

Umbrel's current packaging rules require maintained images for both:

- `linux/amd64`
- `linux/arm64`

Current `fast-push.yml` and `slow-push.yml` publish only `linux/amd64`.

Action:
- Validate the full Docker build and bundled Rusty Kaspa Stratum Bridge on `linux/arm64`.
- Update release workflow to publish a multi-platform manifest for `linux/amd64,linux/arm64`.
- Confirm the resulting GHCR image is publicly pullable on both architectures.

### 2. Official-store manifest cleanup — REQUIRED

Community manifest currently uses:

- `category: kaspa`
- externally hosted `icon:`
- externally hosted `gallery:` entries
- no `website:` field
- `submission: ""`

Official package should use current Umbrel conventions:

- change category to an official taxonomy value; `crypto` matches the official `rusty-kaspad` package.
- omit `icon:` from the official package.
- use `gallery: []` for the initial official submission; provide screenshots and logo in the PR body.
- add an accurate `website:` value.
- set `submission:` to the final upstream Umbrel pull-request URL once created.
- review `manifestVersion`; default to `1` unless a newer framework feature is actually required.

### 3. Canonical repository / source visibility — REVIEW REQUIRED

The canonical development repository `NoillioN-Labs/kaspa-stratum-manager` is currently private.
The Community App Store repository is public and currently contains the sanitized public application source used to build GHCR images.

Decision required before final PR:

A. Make `NoillioN-Labs/kaspa-stratum-manager` public and use it as the canonical `repo:` / `website:` source; or
B. Continue treating `kaspa-stratum-manager-community-store` as the publicly reviewable upstream source for the official package.

Preferred long-term architecture is A if all source can safely be made public.

### 4. Licensing — BLOCKER / POLICY REVIEW

No top-level `LICENSE` file is currently present in either the private development repository or the public Community App Store repository.

Action:
- Determine the intended license for Kaspa Stratum Manager.
- Add an explicit license before official submission if the software is intended to be open source/publicly reviewable.
- Confirm bundled/upstream Rusty Kaspa Stratum Bridge licensing and preserve required notices.

### 5. Rusty Kaspad dependency integration — VERIFY

Current package declares:

`dependencies: [rusty-kaspad]`

The official `rusty-kaspad` package publishes gRPC on host TCP `16110`.
Kaspa Stratum Manager currently reaches it through `host.docker.internal:16110` using `extra_hosts: ["host.docker.internal:host-gateway"]`.

Action:
- Verify this works on supported umbrelOS architectures.
- Check whether a dependency-export contract is available/preferred in current Umbrel packaging rather than relying on the host gateway.
- Document why host-gateway access is necessary if retained.

### 6. Umbrel authentication / app proxy — PASS, VERIFY

Current package uses `app_proxy` and does not disable proxy authentication.

Action:
- Confirm the UI remains protected by Umbrel authentication and 2FA where enabled.
- Ensure no sensitive manager API is exposed through raw host ports.
- Confirm only the Stratum protocol port 5555 is intentionally published to the host/LAN.

### 7. Persistence and restart testing — REQUIRED

Acceptance test before submission:

1. Install official `rusty-kaspad`.
2. Install Kaspa Stratum Manager package through Umbrel.
3. Open UI from Umbrel home screen.
4. Confirm node connectivity.
5. Start Stratum Bridge.
6. Connect a miner to TCP 5555.
7. Confirm miner appears in dashboard.
8. Confirm hashrate/share statistics update.
9. Exercise stop/start/restart controls.
10. Change a safe configuration value.
11. Restart the app.
12. Confirm configuration and history persist.
13. Reboot Umbrel and confirm recovery.
14. Confirm Umbrel authentication still protects the web UI.

### 8. Official Umbrel linting — REQUIRED

Against a fork/clone of `getumbrel/umbrel-apps`, run:

```bash
npm run lint:apps -- kaspa-stratum-manager --check-images
git diff --check
```

All errors must be resolved. Warnings should be intentional and documented in the PR.

## Proposed official package shape

```text
kaspa-stratum-manager/
  umbrel-app.yml
  docker-compose.yml
```

Add `exports.sh`, templates, hooks, or committed data scaffolding only if actually required.

## Pull request evidence

The final PR body should include:

- app name and version
- upstream/project URL
- Docker/GHCR image source
- exact image digest
- architectures tested
- umbrelOS versions/devices tested
- dependency on `rusty-kaspad`
- host access explanation
- published port explanation (`5555/tcp` for miners)
- persistence locations
- authentication model
- install/start/restart/reboot test results
- screenshots
- source logo
- known limitations

## Current readiness assessment

| Area | Status |
|---|---|
| Browser UI | PASS |
| Community Umbrel deployment | PASS |
| `app_proxy` integration | PASS |
| Persistent app data | PASS |
| Image digest pinning | PASS |
| No Docker socket | PASS |
| No privileged mode | PASS |
| No host networking | PASS |
| Official Rusty Kaspad dependency | PASS / integration method to verify |
| Official manifest taxonomy/metadata | NEEDS WORK |
| `linux/amd64` image | PASS |
| `linux/arm64` image | BLOCKER |
| Explicit project license | BLOCKER / REVIEW |
| Canonical public upstream | REVIEW |
| Official Umbrel lint | NOT RUN YET |
| Full install/restart/reboot acceptance test | NOT RUN YET |
| Upstream PR | NOT CREATED |

## Next actions

1. Make the release image multi-architecture and validate ARM64.
2. Resolve project licensing.
3. Decide canonical public source repository strategy.
4. Build official-store manifest and compose files on this branch.
5. Run official Umbrel lint/test cycle.
6. Fork `getumbrel/umbrel-apps`, create submission branch, add package, and open PR.
