import { readFile, copyFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";
import { MiningHistoryStore } from "../server/history.mjs";
import { DashboardMetricsStore } from "../server/metrics.mjs";
import {
  atomicWrite,
  validateSettings,
  updateBridgeYaml,
} from "../server/settings.mjs";

// Offline recovery only. Preserve each original file before replacing anything.
export async function restoreBackup(backupPath, dataDir, write = atomicWrite) {
  const backup = JSON.parse(await readFile(backupPath, "utf8"));
  if (backup.format !== "kaspa-stratum-manager-backup" || backup.version !== 1)
    throw new Error("Unsupported backup format");
  const validation = validateSettings(backup.settings);
  if (validation.issues) throw new Error("Invalid backup settings");
  const scratch = await mkdtemp(path.join(os.tmpdir(), "ksm-restore-check-"));
  try {
    await writeFile(
      path.join(scratch, "history.json"),
      JSON.stringify(backup.history),
    );
    await writeFile(
      path.join(scratch, "metrics.json"),
      JSON.stringify(backup.metrics),
    );
    backup.history = await new MiningHistoryStore({
      path: path.join(scratch, "history.json"),
    }).exportData();
    backup.metrics = await new DashboardMetricsStore({
      path: path.join(scratch, "metrics.json"),
    }).exportData();
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  const configPath = path.join(dataDir, "config.yaml");
  const yaml = updateBridgeYaml(
    await readFile(configPath, "utf8"),
    validation.value,
  );
  const entries = [
    ["mining-history.json", JSON.stringify(backup.history) + "\n"],
    ["dashboard-metrics.json", JSON.stringify(backup.metrics) + "\n"],
    ["config.yaml", yaml],
  ];
  const originals = new Map(),
    suffix = `.before-restore-${Date.now()}`;
  for (const [name] of entries) {
    const target = path.join(dataDir, name);
    try {
      originals.set(target, await readFile(target, "utf8"));
      await copyFile(target, target + suffix);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      originals.set(target, null);
    }
  }
  try {
    for (const [name, content] of entries)
      await write(path.join(dataDir, name), content);
  } catch (error) {
    for (const [target, content] of originals) {
      if (content === null) await rm(target, { force: true });
      else await atomicWrite(target, content);
    }
    throw error;
  }
  return { restored: entries.map(([name]) => name), originalSuffix: suffix };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (
    process.argv[2] !== "--offline-confirm" ||
    !process.argv[3] ||
    !process.argv[4]
  )
    throw new Error(
      "Stop the app first. Usage: node scripts/restore-backup.mjs --offline-confirm backup.json /data",
    );
  console.log(
    await restoreBackup(process.argv[3], path.resolve(process.argv[4])),
  );
}
