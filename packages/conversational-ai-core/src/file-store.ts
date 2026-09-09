import {
  existsSync,
  readdirSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

function getBaseDir() {
  const baseDir =
    process.env.CONVERSATIONAL_AI_STATE_DIR ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), ".kilo", "conversational-ai");
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

function toSafeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function getFilePath(namespace: string, key: string) {
  const directory = path.join(getBaseDir(), toSafeName(namespace));
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  return path.join(directory, `${toSafeName(key)}.json`);
}

export function readStoredJson<T>(namespace: string, key: string): T | null {
  const filePath = getFilePath(namespace, key);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeStoredJson(namespace: string, key: string, value: unknown) {
  const filePath = getFilePath(namespace, key);
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function deleteStoredJson(namespace: string, key: string) {
  const filePath = getFilePath(namespace, key);
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
  }
}

export function listStoredJsonKeys(namespace: string) {
  const directory = path.join(getBaseDir(), toSafeName(namespace));
  if (!existsSync(directory)) {
    return [] as string[];
  }

  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.replace(/\.json$/i, ""));
}
