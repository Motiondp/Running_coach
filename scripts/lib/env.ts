import { config } from "dotenv";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// Load .env from the repo root (scripts/.. ).
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
config({ path: resolve(repoRoot, ".env") });

export const ROOT = repoRoot;

export function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(
      `Missing env var ${name}. Copy .env.example to .env and fill it in (see assumption A3).`,
    );
  }
  return v;
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

/** True when `metaUrl` (import.meta.url) is the script invoked from the CLI. */
export function isMain(metaUrl: string): boolean {
  const argv1 = process.argv[1];
  return !!argv1 && metaUrl === pathToFileURL(argv1).href;
}
