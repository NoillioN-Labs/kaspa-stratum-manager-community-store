import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const ignored = new Set([".docker-runtime", ".git", ".next", ".sites-runtime", ".wrangler", "dist", "node_modules", "upload"]);
const forbiddenNames = /^(?:\.env(?:\.local)?|id_rsa|id_ed25519)$/i;
const checks = [
  ["private hostname", /umbrel\.local/i],
  ["private IPv4 address", /(?:^|[^\d])(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?:[^\d]|$)/],
  ["Kaspa wallet address", /kaspa(?:test)?:[a-z0-9]{20,}/i],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{20,}/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["JWT", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
];

const files = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else files.push(full);
  }
};
await walk(root);

const findings = [];
for (const file of files) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (forbiddenNames.test(path.basename(file)) && path.basename(file) !== ".env.example") findings.push(`${relative}: forbidden sensitive filename`);
  let source;
  try { source = await readFile(file, "utf8"); } catch { continue; }
  for (const [label, pattern] of checks) if (pattern.test(source)) findings.push(`${relative}: ${label}`);
}

if (findings.length) {
  console.error("Public safety check failed:\n" + findings.join("\n"));
  process.exit(1);
}
console.log(`Public safety check passed (${files.length} files scanned)`);
