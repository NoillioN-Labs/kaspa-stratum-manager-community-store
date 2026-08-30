import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [dockerfile, compose, manifest, config, route, entrypoint, preStart, packageLock, manager, settings, history] = await Promise.all([
  read("Dockerfile"), read("docker-compose.yml"), read("umbrel-app.yml"),
  read("config/bridge.yaml"),
  read("app/api/manager/[...path]/route.ts"), read("docker/entrypoint.sh"), read("hooks/pre-start"),
  read("package-lock.json"), read("server/manager.mjs"), read("server/settings.mjs"), read("server/history.mjs"),
]);

const parsedPackageLock = JSON.parse(packageLock);
const milestoneVersion = manifest.match(/^version: "(\d+\.\d+\.\d+)"$/m)?.[1];
assert.equal(parsedPackageLock.name, "kaspa-stratum-manager");
assert.equal(parsedPackageLock.version, "0.2.0");
assert.equal(parsedPackageLock.lockfileVersion, 3);

assert.match(dockerfile, /RUSTY_KASPA_VERSION=v2\.0\.1/);
assert.match(dockerfile, /RUSTY_KASPA_COMMIT=cfafeb4c093fa37a303f1b9f19c58f986b870ce3/);
assert.match(dockerfile, /cargo build --locked --release -p kaspa-stratum-bridge --bin stratum-bridge/);
assert.match(dockerfile, /find scripts docker -type f -name '\*\.sh' -exec sed -i/);
assert.match(dockerfile, /COPY --from=app-build \/app\/docker\/entrypoint\.sh/);
assert.match(compose, /BRIDGE_COMMAND: \/usr\/local\/bin\/stratum-bridge/);
assert.match(compose, /"5555:5555\/tcp"/);
const pinnedImages = [...compose.matchAll(/image: (ghcr\.io\/noillion-labs\/kaspa-stratum-manager:[^\s@]+@sha256:[a-f0-9]{64})/g)].map((match) => match[1]);
assert.equal(pinnedImages.length, 2);
assert.equal(pinnedImages[0], pinnedImages[1]);
assert.ok(milestoneVersion, "Umbrel manifest must contain a semantic version");
assert.match(manifest, /^icon: https:\/\/raw\.githubusercontent\.com\/NoillioN-Labs\/kaspa-stratum-manager-community-store\/main\/kaspa-stratum-manager\/icon\.svg$/m);
assert.match(compose, new RegExp(`^\\s+APP_VERSION: "${milestoneVersion.replace(/\./g, "\\.")}"$`, "m"));
assert.match(compose, /^\s+BRIDGE_VERSION: "2\.0\.1"$/m);
const expectedImageTag = process.env.KSM_PACKAGE_CHANNEL === "fast" ? "fast" : milestoneVersion;
assert.equal(pinnedImages[0].split("@")[0], `ghcr.io/noillion-labs/kaspa-stratum-manager:${expectedImageTag}`);
assert.match(pinnedImages[0], /@sha256:[a-f0-9]{64}$/);
assert.doesNotMatch(compose, /^\s+build:/m);
assert.match(config, /stratum_port: ":5555"/);
assert.match(config, /kaspad_address: "host\.docker\.internal:16110"/);
assert.match(config, /# manager_preset: automatic/);
assert.match(route, /MANAGER_INTERNAL_URL/);
assert.match(route, /export const PUT = proxy/);
assert.match(manager, /\/api\/manager\/settings/);
assert.match(manager, /config\.last-good\.yaml/);
assert.match(manager, /Settings failed health check; restoring last-known-good configuration/);
assert.match(manager, /\/api\/manager\/history/);
assert.match(manager, /mining-history\.json/);
assert.match(history, /SEVEN_DAYS_MS/);
assert.match(history, /probabilityNextWindow/);
assert.doesNotMatch(history, /wallet|password|credential/i);
assert.match(settings, /The Umbrel miner port is protected at 5555/);
assert.match(settings, /This setting is not editable/);
assert.doesNotMatch(settings, /kaspad_address|KASPA_NODE_GRPC/);
assert.match(entrypoint, /config\.yaml/);
assert.match(preStart, /install -d -m 0750 -o 1000 -g 1000/);
assert.match(preStart, /chown -R 1000:1000/);

console.log("Umbrel packaging contract verified");

