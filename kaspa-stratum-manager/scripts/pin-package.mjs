import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const [mode, digest, requestedVersion] = process.argv.slice(2);
assert.ok(mode === "fast" || mode === "slow", "Mode must be fast or slow");
assert.match(digest ?? "", /^sha256:[a-f0-9]{64}$/, "A valid immutable digest is required");

const composeUrl = new URL("../docker-compose.yml", import.meta.url);
const manifestUrl = new URL("../umbrel-app.yml", import.meta.url);
const fastDockerfileUrl = new URL("../Dockerfile.fast", import.meta.url);
let compose = await readFile(composeUrl, "utf8");
let manifest = await readFile(manifestUrl, "utf8");
const current = manifest.match(/^version: "(\d+)\.(\d+)\.(\d+)"$/m);
assert.ok(current, "Umbrel manifest must contain a semantic version");

const version = mode === "fast"
  ? `${current[1]}.${current[2]}.${Number(current[3]) + 1}`
  : requestedVersion;
assert.match(version ?? "", /^\d+\.\d+\.\d+$/, "Release version must use major.minor.patch");
const tag = mode === "fast" ? "fast" : version;
const image = `ghcr.io/noillion-labs/kaspa-stratum-manager:${tag}@${digest}`;

compose = compose.replace(/ghcr\.io\/noillion-labs\/kaspa-stratum-manager:[^\s@]+@sha256:[a-f0-9]{64}/g, image);
assert.equal([...compose.matchAll(new RegExp(image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))].length, 2, "Both services must use the new image");
assert.match(compose, /^\s+APP_VERSION: "[^"]+"$/m, "Manager environment must declare APP_VERSION");
compose = compose.replace(/^(\s+APP_VERSION:)\s*"[^"]+"$/m, `$1 "${version}"`);
manifest = manifest.replace(/^version: ".*"$/m, `version: "${version}"`);
const notes = "Minor bug fixes and improvements.";
manifest = manifest.replace(/releaseNotes: >-[\s\S]*?\npath:/m, `releaseNotes: >-\n  ${notes}\npath:`);

await writeFile(composeUrl, compose);
await writeFile(manifestUrl, manifest);

if (mode === "slow") {
  let fastDockerfile = await readFile(fastDockerfileUrl, "utf8");
  fastDockerfile = fastDockerfile.replace(
    /^FROM ghcr\.io\/noillion-labs\/kaspa-stratum-manager:[^\s@]+@sha256:[a-f0-9]{64} AS release-base$/m,
    `FROM ghcr.io/noillion-labs/kaspa-stratum-manager:${version}@${digest} AS release-base`,
  );
  await writeFile(fastDockerfileUrl, fastDockerfile);
}
console.log(`${mode} package pinned as ${version}: ${image}`);
