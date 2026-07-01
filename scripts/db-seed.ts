/**
 * Seed the single Crucible user + starter data.
 *
 *   npm run db:seed
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env — the service-role key
 * is admin-only, never ships to the app, and must stay out of git (it's covered by
 * the existing .env gitignore rule).
 *
 * "RLS-ready, no login UI" means there is still one REAL Supabase auth user (so
 * auth.uid() and row-level security are genuine, not faked) — the app just signs in
 * as that user automatically instead of showing a login screen. This script creates
 * that user if missing, then seeds the athlete profile + a starter routine so the
 * Phase 1 lift logger has something to select.
 */
import { createClient } from "@supabase/supabase-js";
import { env, isMain } from "./lib/env.js";

const SEED_EMAIL = "dan@motiondp.com";
// Dev-only seed password for the single athlete account. Not a secret worth protecting
// beyond .env — there is no other user, and the account has no payment/PII surface yet.
const SEED_PASSWORD = "ROTATED-REDACTED-PASSWORD";

async function main(): Promise<void> {
  const url = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("=== Crucible DB seed ===");

  // 1. Find or create the single athlete auth user.
  let userId: string | undefined;
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;
  userId = existing.users.find((u) => u.email === SEED_EMAIL)?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`✓ Created auth user ${SEED_EMAIL} (${userId})`);
  } else {
    console.log(`✓ Auth user already exists: ${SEED_EMAIL} (${userId})`);
  }

  // 2. Upsert the athlete profile (matches scripts/build-snapshot.ts's sample goal).
  const { error: athleteErr } = await admin.from("athlete").upsert({
    id: userId,
    name: "Dan",
    timezone: "Pacific/Auckland",
    priority: "fat_loss",
    goal_race_name: "Auckland Marathon",
    goal_race_distance_km: 42.2,
    goal_race_date: "2026-11-01",
    goal_race_target_time: "03:30:00",
    bodycomp_target_weight: 85,
    bodycomp_target_fat_pct: 18,
    bodycomp_target_muscle: 65,
  });
  if (athleteErr) throw athleteErr;
  console.log("✓ Athlete profile seeded");

  // 3. Starter exercises + a routine so the lift logger has something to open.
  const exercises = [
    { name: "Back Squat", muscle_groups: ["quads", "glutes"] },
    { name: "Deadlift", muscle_groups: ["posterior_chain", "glutes"] },
    { name: "Bench Press", muscle_groups: ["chest", "triceps"] },
    { name: "Pull-up", muscle_groups: ["back", "biceps"] },
    { name: "Overhead Press", muscle_groups: ["shoulders", "triceps"] },
  ];
  const { data: existingExercises } = await admin
    .from("exercise")
    .select("id, name")
    .eq("user_id", userId);
  const haveNames = new Set((existingExercises ?? []).map((e) => e.name));
  const toInsert = exercises
    .filter((e) => !haveNames.has(e.name))
    .map((e) => ({ ...e, user_id: userId }));

  if (toInsert.length > 0) {
    const { error: exErr } = await admin.from("exercise").insert(toInsert);
    if (exErr) throw exErr;
    console.log(`✓ Seeded ${toInsert.length} starter exercise(s)`);
  } else {
    console.log("✓ Starter exercises already present");
  }

  console.log("\n✓ Seed complete.");
  console.log(
    `  App sign-in (dev-only, until Phase 1's real auth): ${SEED_EMAIL} / ${SEED_PASSWORD}`,
  );
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`\n✗ Seed failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
