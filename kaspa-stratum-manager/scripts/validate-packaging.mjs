import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [dockerfile, compose, config, route, entrypoint, preStart, packageLock] = await Promise.all([
  read("Dockerfile"), read("docker-compose.yml"), read("config/bridge.yaml"),
  read("app/api/manager/[...path]/route.ts"), read("docker/entrypoint.sh"), read("hooks/pre-start"),
  read("package-lock.json"),
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
assert.match(compose, /"5555:5555\/tcp"/);
assert.doesNotMatch(compose, /^\s+image: kaspa-stratum-manager:/m);
assert.equal((compose.match(/context: \$\{APP_DATA_DIR\}/g) || []).length, 2);
assert.match(config, /stratum_port: ":5555"/);
assert.match(config, /kaspad_address: "host\.docker\.internal:16110"/);
assert.match(route, /MANAGER_INTERNAL_URL/);
assert.match(entrypoint, /config\.yaml/);
assert.match(preStart, /install -d -m 0750 -o 1000 -g 1000/);
assert.match(preStart, /chown -R 1000:1000/);

console.log("Umbrel packaging contract verified");
