/**
 * Adapter from the Technogym export on disk to the shapes `@crucible/core` expects.
 *
 * Accepts either a real export ZIP or an unzipped directory (used by the synthetic
 * fixture). Reading the archive lives HERE in the script layer so `@crucible/core`
 * stays dependency-free. The mapping of raw file fields → RawBodyMeasurement is the
 * one place to adjust once a real export's exact field names are known (assumption A2).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import type { RawBodyMeasurement, RawGymSession } from "@crucible/core";

export interface TechnogymSource {
  measurements: RawBodyMeasurement[];
  sessions: RawGymSession[];
  files: string[];
}

type Json = unknown;

/** Read every *.json file from a ZIP or directory, keyed by filename. */
function readJsonFiles(path: string): Map<string, Json> {
  const out = new Map<string, Json>();
  const isZip = path.toLowerCase().endsWith(".zip");

  if (isZip) {
    const buf = readFileSync(path);
    const entries = unzipSync(new Uint8Array(buf));
    for (const [name, bytes] of Object.entries(entries)) {
      if (name.toLowerCase().endsWith(".json")) {
        out.set(name.split("/").pop() ?? name, JSON.parse(strFromU8(bytes)));
      }
    }
  } else if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) {
      if (name.toLowerCase().endsWith(".json")) {
        out.set(name, JSON.parse(readFileSync(join(path, name), "utf8")));
      }
    }
  } else {
    throw new Error(`Technogym source not found or unsupported: ${path}`);
  }
  return out;
}

/** Pull an array out of a file that is either a bare array or `{ key: [...] }`. */
function asArray(json: Json, key: string): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const v = (json as Record<string, unknown>)[key];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function findFile(files: Map<string, Json>, ...needles: string[]): Json | undefined {
  for (const [name, json] of files) {
    const lower = name.toLowerCase();
    if (needles.some((n) => lower.includes(n))) return json;
  }
  return undefined;
}

export function loadTechnogymSource(path: string): TechnogymSource {
  const files = readJsonFiles(path);

  const bodyFile = findFile(files, "body-composition", "bodycomp", "composition", "measurement");
  const sessionsFile = findFile(files, "indoor", "session", "gym");

  return {
    measurements: asArray(bodyFile, "measurements") as RawBodyMeasurement[],
    sessions: asArray(sessionsFile, "sessions") as RawGymSession[],
    files: [...files.keys()],
  };
}
