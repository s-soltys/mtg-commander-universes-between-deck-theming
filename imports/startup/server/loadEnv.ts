import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILENAMES = [".env", ".env.local"] as const;

const parseEnvLine = (line: string): { key: string; value: string } | null => {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const value = stripWrappingQuotes(rawValue);

  return { key, value };
};

const stripWrappingQuotes = (value: string): string => {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
};

export const loadEnvFiles = (): void => {
  const baseDir = resolveAppRoot();
  const originalEnvKeys = new Set(Object.keys(process.env));
  const loadedFromFile = new Map<string, string>();

  for (const filename of ENV_FILENAMES) {
    const filepath = resolve(baseDir, filename);
    if (!existsSync(filepath)) {
      continue;
    }

    const contents = readFileSync(filepath, "utf8");
    const lines = contents.split(/\r?\n/);

    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      const existingValue = process.env[parsed.key];
      const hasNonEmptyExistingValue =
        typeof existingValue === "string" && existingValue.trim().length > 0;

      // Shell-provided non-empty values win. Empty values may be overridden by env files.
      if (originalEnvKeys.has(parsed.key) && hasNonEmptyExistingValue) {
        continue;
      }

      process.env[parsed.key] = parsed.value;
      loadedFromFile.set(parsed.key, filename);
    }
  }

  const openAIKey = process.env.OPENAI_API_KEY;
  const hasOpenAIKey = typeof openAIKey === "string" && openAIKey.trim().length > 0;
  const openAIKeySource = loadedFromFile.get("OPENAI_API_KEY")
    ?? (originalEnvKeys.has("OPENAI_API_KEY") ? "process-env" : "missing");
  console.info(
    `[env] OPENAI_API_KEY loaded=${hasOpenAIKey ? "yes" : "no"} source=${openAIKeySource} baseDir=${baseDir}`,
  );
};

const resolveAppRoot = (): string => {
  const explicitPwd = process.env.PWD;
  if (explicitPwd && existsSync(resolve(explicitPwd, ".meteor", "release"))) {
    return explicitPwd;
  }

  const cwd = process.cwd();
  const foundFromCwd = findMeteorRootFrom(cwd);
  if (foundFromCwd) {
    return foundFromCwd;
  }

  return cwd;
};

const findMeteorRootFrom = (startDir: string): string | null => {
  let current = startDir;

  for (let i = 0; i < 20; i += 1) {
    if (existsSync(resolve(current, ".meteor", "release"))) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return null;
};

loadEnvFiles();
