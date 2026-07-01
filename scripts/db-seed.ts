/**
 * Seed the single Crucible user + starter data.
 *
 *   npm run db:seed
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env — the service-role key
 * is admin-only, never ships to the app, and must stay out of git (it's covered by
 * the existing .env gitignore rule).
 *
 * "RLS-ready, no login UI (initially)" means there is one REAL Supabase auth user (so
 * auth.uid() and row-level security are genuine, not faked). The app now has a real
 * login screen (apps/mobile/src/app/login.tsx) — this script only ever CREATES the
 * account; it never hardcodes or re-sets a password. On first run it generates a
 * random one and prints it ONCE to the console (never written to a file) — note it
 * down or change it via `supabase.auth.admin.updateUserById` / the dashboard.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env, isMain } from "./lib/env.js";

const SEED_EMAIL = "dan@motiondp.com";

async function main(): Promise<void> {
  const url = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("=== Crucible DB seed ===");

  // 1. Find or create the single athlete auth user.
  let userId: string | undefined;
  let generatedPassword: string | undefined;
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;
  userId = existing.users.find((u) => u.email === SEED_EMAIL)?.id;

  if (!userId) {
    generatedPassword = randomBytes(18).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email: SEED_EMAIL,
      password: generatedPassword,
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

  // 4. Starter routines so the lift logger has something to open. References
  // exercises by id — re-fetch now that inserts above are guaranteed present.
  const { data: allExercises, error: allExErr } = await admin
    .from("exercise")
    .select("id, name")
    .eq("user_id", userId);
  if (allExErr) throw allExErr;
  const exerciseId = (name: string): string => {
    const found = allExercises?.find((e) => e.name === name);
    if (!found) throw new Error(`Seed routine references unknown exercise "${name}"`);
    return found.id;
  };

  const routines = [
    {
      name: "Push A",
      exercises: [
        { exercise_id: exerciseId("Bench Press"), target_sets: 4, target_reps: 8 },
        { exercise_id: exerciseId("Overhead Press"), target_sets: 3, target_reps: 10 },
      ],
    },
    {
      name: "Pull B",
      exercises: [
        { exercise_id: exerciseId("Deadlift"), target_sets: 3, target_reps: 5 },
        { exercise_id: exerciseId("Pull-up"), target_sets: 4, target_reps: 8 },
      ],
    },
    {
      name: "Legs",
      exercises: [{ exercise_id: exerciseId("Back Squat"), target_sets: 4, target_reps: 5 }],
    },
  ];

  const { data: existingRoutines } = await admin.from("routine").select("name").eq("user_id", userId);
  const haveRoutineNames = new Set((existingRoutines ?? []).map((r) => r.name));
  const routinesToInsert = routines
    .filter((r) => !haveRoutineNames.has(r.name))
    .map((r) => ({ ...r, user_id: userId }));

  if (routinesToInsert.length > 0) {
    const { error: routineErr } = await admin.from("routine").insert(routinesToInsert);
    if (routineErr) throw routineErr;
    console.log(`✓ Seeded ${routinesToInsert.length} starter routine(s)`);
  } else {
    console.log("✓ Starter routines already present");
  }

  console.log("\n✓ Seed complete.");
  if (generatedPassword) {
    console.log(
      `\n  New account password (shown once, not saved anywhere) — ${SEED_EMAIL} / ${generatedPassword}`,
    );
    console.log("  Use this to sign in at /login. Change it via the Supabase dashboard if you'd like.");
  }
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(`\n✗ Seed failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
