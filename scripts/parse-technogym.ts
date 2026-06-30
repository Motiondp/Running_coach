/**
 * Phase 0.2 — parse a Technogym export (ZIP or fixture directory) into the body-comp
 * panel, proving the per-metric dates and the NZ-local bucketing.
 *
 *   npm run parse:technogym                 # uses the synthetic fixture
 *   npm run parse:technogym -- path/to.zip  # a real export ZIP (assumption A2)
 */
import { parseBodyComp, toBodyCompSection, inferExerciseKind, DEFAULT_TZ } from "@crucible/core";
import { resolve } from "node:path";
import { optionalEnv, isMain, ROOT } from "./lib/env.js";
import { loadTechnogymSource } from "./lib/technogym-source.js";

const DEFAULT_FIXTURE = "fixtures/technogym-sample";

export function parseTechnogym(sourcePath: string, tz: string) {
  const source = loadTechnogymSource(sourcePath);
  console.log(`\n=== Technogym export: ${sourcePath} ===`);
  console.log(`Files: ${source.files.join(", ")}`);
  console.log(`Measurements: ${source.measurements.length}, gym sessions: ${source.sessions.length}`);

  const parsed = parseBodyComp(source.measurements, { tz });

  console.log("\nLatest value per metric (NZ-local dated):");
  for (const [metric, dm] of Object.entries(parsed.metrics)) {
    console.log(`  ${metric.padEnd(10)} ${String(dm?.value).padStart(7)} ${dm?.unit.padEnd(4)} @ ${dm?.date}`);
  }
  if (parsed.unmapped.length > 0) {
    console.log(`\n⚠ ${parsed.unmapped.length} unmapped row(s) (UUID-only/unknown — not guessed):`);
    for (const u of parsed.unmapped) console.log(`  ${JSON.stringify(u)}`);
  }

  const section = toBodyCompSection(parsed, { trainingBurnKcal: 700, deficitKcal: 500 });
  console.log("\nDerived bodycomp section:");
  console.log(JSON.stringify(section, null, 2));

  // Phase 0 question: is per-set lifting data usable?
  if (source.sessions.length > 0) {
    console.log("\nGym session exercise inference (quirk #1 — UUID-only):");
    for (const s of source.sessions) {
      for (const ex of s.exercises ?? []) {
        console.log(`  ${ex.exerciseId ?? ex.name ?? "?"} → ${inferExerciseKind(ex)}`);
      }
    }
  }

  return { parsed, section };
}

if (isMain(import.meta.url)) {
  const argPath = process.argv[2];
  const tz = optionalEnv("ATHLETE_TZ") ?? DEFAULT_TZ;
  const sourcePath = argPath ? resolve(argPath) : resolve(ROOT, DEFAULT_FIXTURE);
  try {
    parseTechnogym(sourcePath, tz);
    console.log("\n✓ Technogym parse OK");
  } catch (err) {
    console.error(`\n✗ ${(err as Error).message}`);
    process.exit(1);
  }
}
