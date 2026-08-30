import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  dockerfile, compose, config, route, entrypoint, packageLock, manager, settings,
  history, store, communityCompose, communityManifest,
] = await Promise.all([
  read("Dockerfile"), read("docker-compose.yml"), read("config/bridge.yaml"),
  read("app/api/manager/[...path]/route.ts"), read("docker/entrypoint.sh"),
  read("package-lock.json"), read("server/manager.mjs"), read("server/settings.mjs"), read("server/history.mjs"),
  read("umbrel-app-store.yml"),
  read("kaspa-stratum-manager/docker-compose.yml"),
  read("kaspa-stratum-manager/umbrel-app.yml"),
]);

const parsedPackageLock = JSON.parse(packageLock);
assert.equal(parsedPackageLock.name, "kaspa-stratum-manager");
assert.equal(parsedPackageLock.version, "0.2.0");
assert.equal(parsedPackageLock.lockfileVersion, 3);

assert.match(dockerfile, /RUSTY_KASPA_VERSION=v2\.0\.1/);
assert.match(dockerfile, /RUSTY_KASPA_COMMIT=cfafeb4c093fa37a303f1b9f19c58f986b870ce3/);
assert.match(dockerfile, /cargo build --locked --release -p kaspa-stratum-bridge --bin stratum-bridge/);
assert.match(dockerfile, /find scripts docker -type f -name '\*\.sh' -exec sed -i/);
assert.match(dockerfile, /COPY --from=app-build \/app\/docker\/entrypoint\.sh/);
assert.match(compose, /BRIDGE_COMMAND: \/usr\/local\/bin\/stratum-bridge/);
assert.match(compose, /APP_VERSION: "0\.3\.0"/);
assert.match(compose, /BRIDGE_VERSION: "2\.0\.1"/);
assert.match(compose, /"5555:5555\/tcp"/);
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
assert.match(store, /^id: "kaspa"/m);
assert.match(communityManifest, /^id: kaspa-stratum-manager$/m);
assert.match(communityManifest, /^dependencies: \[rusty-kaspad\]$/m);
assert.match(
  communityCompose,
  /kaspa-stratum-manager\.git#4a9d377622d787efd85c1e904562e39ea5cf0ac1/,
);
assert.match(communityCompose, /"5555:5555\/tcp"/);
assert.match(communityCompose, /BRIDGE_VERSION: "2\.0\.1"/);
assert.doesNotMatch(communityCompose, /(?:token|password|wallet|192\.168\.|10\.)/i);

console.log("Umbrel packaging contract verified");

