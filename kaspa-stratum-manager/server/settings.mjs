import { open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

export const AUTOMATIC_SETTINGS = Object.freeze({
  preset: "automatic",
  stratumPort: 5555,
  variableDifficulty: true,
  sharesPerMinute: 30,
  powerOfTwoClamp: true,
  extranonceSize: 2,
  minimumShareDifficulty: 2048,
});

export const ICERIVER_SETTINGS = Object.freeze({ ...AUTOMATIC_SETTINGS, preset: "iceriver" });
const allowedKeys = new Set(Object.keys(AUTOMATIC_SETTINGS));

const scalar = (source, key, instance = false) => {
  const scope = instance ? source.slice(source.search(/^instances:\s*$/m)) : source;
  const match = scope.match(new RegExp(`^\\s*(?:-\\s*)?${key}:\\s*["']?([^"'#\\s]+)["']?`, "m"));
  if (!match) throw new Error(`Bridge configuration is missing ${key}`);
  return match[1];
};

const asBoolean = (value, key) => {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Bridge configuration has an invalid ${key}`);
};

const asInteger = (value, key) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Bridge configuration has an invalid ${key}`);
  return parsed;
};

const portNumber = (value, key) => asInteger(value.replace(/^:/, ""), key);
const sameTuning = (left, right) => [
  "stratumPort", "variableDifficulty", "sharesPerMinute", "powerOfTwoClamp",
  "extranonceSize", "minimumShareDifficulty",
].every((key) => left[key] === right[key]);

export const parseBridgeSettings = (source) => {
  const settings = {
    stratumPort: portNumber(scalar(source, "stratum_port", true), "stratum_port"),
    variableDifficulty: asBoolean(scalar(source, "var_diff"), "var_diff"),
    sharesPerMinute: asInteger(scalar(source, "shares_per_min"), "shares_per_min"),
    powerOfTwoClamp: asBoolean(scalar(source, "pow2_clamp"), "pow2_clamp"),
    extranonceSize: asInteger(scalar(source, "extranonce_size"), "extranonce_size"),
    minimumShareDifficulty: asInteger(scalar(source, "min_share_diff", true), "min_share_diff"),
  };
  const marker = source.match(/^# manager_preset: (automatic|iceriver|custom)\s*$/m)?.[1];
  const preset = marker === "iceriver" && sameTuning(settings, ICERIVER_SETTINGS)
    ? "iceriver"
    : marker === "automatic" && sameTuning(settings, AUTOMATIC_SETTINGS)
      ? "automatic"
      : "custom";
  return { ...settings, preset: marker ? preset : sameTuning(settings, AUTOMATIC_SETTINGS) ? "automatic" : "custom" };
};

const issue = (field, message) => ({ field, message });
const integerInRange = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const isPowerOfTwo = (value) => Number.isSafeInteger(value) && value > 0 && (BigInt(value) & (BigInt(value) - 1n)) === 0n;

export const validateSettings = (input) => {
  const issues = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { issues: [issue("settings", "Settings must be a JSON object.")] };
  for (const key of Object.keys(input)) if (!allowedKeys.has(key)) issues.push(issue(key, "This setting is not editable."));
  if (!["automatic", "iceriver", "custom"].includes(input.preset)) issues.push(issue("preset", "Choose Automatic, IceRiver, or Custom."));
  if (!integerInRange(input.stratumPort, 1024, 65535)) issues.push(issue("stratumPort", "Use a port from 1024 to 65535."));
  else if (input.stratumPort !== 5555) issues.push(issue("stratumPort", "The Umbrel miner port is protected at 5555."));
  if (typeof input.variableDifficulty !== "boolean") issues.push(issue("variableDifficulty", "Choose on or off."));
  if (!integerInRange(input.sharesPerMinute, 1, 120)) issues.push(issue("sharesPerMinute", "Use 1 to 120 shares per minute."));
  if (typeof input.powerOfTwoClamp !== "boolean") issues.push(issue("powerOfTwoClamp", "Choose on or off."));
  if (!integerInRange(input.extranonceSize, 1, 4)) issues.push(issue("extranonceSize", "Use an extranonce size from 1 to 4."));
  if (!integerInRange(input.minimumShareDifficulty, 1, 4_294_967_296) || !isPowerOfTwo(input.minimumShareDifficulty)) {
    issues.push(issue("minimumShareDifficulty", "Use a power of two from 1 to 4,294,967,296."));
  }
  if (input.variableDifficulty === false && input.powerOfTwoClamp === true) issues.push(issue("powerOfTwoClamp", "Power-of-two clamping requires variable difficulty."));
  if (input.variableDifficulty === true && input.powerOfTwoClamp !== true) issues.push(issue("powerOfTwoClamp", "Keep power-of-two clamping on with variable difficulty for ASIC compatibility."));
  if (input.preset === "automatic" || input.preset === "iceriver") {
    const expected = input.preset === "iceriver" ? ICERIVER_SETTINGS : AUTOMATIC_SETTINGS;
    if (!sameTuning(input, expected)) issues.push(issue("preset", "Recommended presets must use their protected tuning values. Choose Custom to edit them."));
  }
  return issues.length ? { issues } : { value: { ...input } };
};

const replaceScalar = (source, key, value, instance = false) => {
  const start = instance ? source.search(/^instances:\s*$/m) : 0;
  if (start < 0) throw new Error("Bridge configuration is missing instances");
  const prefix = source.slice(0, start);
  const scope = source.slice(start);
  const pattern = new RegExp(`^(\\s*(?:-\\s*)?${key}:\\s*)([^#\\r\\n]*?)(\\s*(?:#.*)?)$`, "m");
  if (!pattern.test(scope)) throw new Error(`Bridge configuration is missing ${key}`);
  return prefix + scope.replace(pattern, `$1${value}$3`);
};

export const updateBridgeYaml = (source, settings) => {
  let result = /^# manager_preset:/m.test(source)
    ? source.replace(/^# manager_preset:.*$/m, `# manager_preset: ${settings.preset}`)
    : `# manager_preset: ${settings.preset}\n${source}`;
  result = replaceScalar(result, "var_diff", String(settings.variableDifficulty));
  result = replaceScalar(result, "shares_per_min", String(settings.sharesPerMinute));
  result = replaceScalar(result, "pow2_clamp", String(settings.powerOfTwoClamp));
  result = replaceScalar(result, "extranonce_size", String(settings.extranonceSize));
  result = replaceScalar(result, "stratum_port", `\":${settings.stratumPort}\"`, true);
  result = replaceScalar(result, "min_share_diff", String(settings.minimumShareDifficulty), true);
  return result;
};

export const atomicWrite = async (target, contents) => {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
};

export const readSettingsFile = async (settingsPath) => parseBridgeSettings(await readFile(settingsPath, "utf8"));

export const sanitizedSettingsModel = (settings) => ({
  settings,
  presets: {
    automatic: { ...AUTOMATIC_SETTINGS, label: "Automatic (recommended)" },
    iceriver: { ...ICERIVER_SETTINGS, label: "IceRiver ASIC" },
  },
  protected: {
    nodeConnection: "Managed by Umbrel",
    credentialsStored: false,
  },
});
