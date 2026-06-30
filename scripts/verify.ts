/**
 * Phase 0 exit criteria — `npm run verify`.
 *
 * Runs the spine check end-to-end:
 *   1. intervals.icu coverage report (live, if INTERVALS_API_KEY is set)
 *   2. Combined athlete-snapshot assembly (manual body-comp + lifts) → artifacts/snapshot.json
 *   3. Technogym ZIP importer smoke-test (OPTIONAL — there is no clean Technogym export,
 *      so manual entry is the primary body-comp path; this just keeps the importer honest
 *      in case a GDPR data request ever lands).
 *
 * If this assembles cleanly from real data, the whole app is de-risked.
 */
import { resolve } from "node:path";
import { optionalEnv, ROOT } from "./lib/env.js";
import { verifyIntervals } from "./verify-intervals.js";
import { parseTechnogym } from "./parse-technogym.js";
import { buildSnapshot } from "./build-snapshot.js";
import { DEFAULT_TZ } from "@crucible/core";

async function main(): Promise<void> {
  let ok = true;

  console.log("\n########## PHASE 0 — PROVE THE SPINE ##########");

  // 1. intervals.icu (skip gracefully if no key yet)
  if (optionalEnv("INTERVALS_API_KEY")) {
    ok = (await verifyIntervals()) && ok;
  } else {
    console.log("\n[1/3] intervals.icu — SKIPPED (no INTERVALS_API_KEY in .env yet).");
    console.log("      Add the key to verify the endurance spine live (assumption A3).");
  }

  // 2. Combined snapshot (body-comp via manual entry — the primary path)
  console.log("\n[2/3] Athlete-snapshot assembly (manual body-comp + lifts)");
  try {
    await buildSnapshot();
  } catch (err) {
    ok = false;
    console.error(`✗ Snapshot assembly failed: ${(err as Error).message}`);
  }

  // 3. Technogym importer smoke-test — optional, never fails the run
  console.log("\n[3/3] Technogym ZIP importer (optional self-check)");
  try {
    parseTechnogym(resolve(ROOT, "fixtures/technogym-sample"), optionalEnv("ATHLETE_TZ") ?? DEFAULT_TZ);
  } catch (err) {
    console.warn(`~ Optional Technogym importer check failed (non-fatal): ${(err as Error).message}`);
  }

  console.log(`\n########## PHASE 0 ${ok ? "PASS ✓" : "INCOMPLETE ✗"} ##########\n`);
  process.exit(ok ? 0 : 1);
}

main();
