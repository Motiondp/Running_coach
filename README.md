# Crucible

Personal AI coaching app for a hybrid athlete (endurance + strength) chasing a race
goal *and* a body-composition goal at once. It eliminates manual data entry: pulls
training/recovery/body/nutrition data in automatically, captures the two signals
machines can't see (subjective readiness + pain), and resolves **both load engines into
one daily Green/Amber/Red verdict**.

> Status: **Phase 0 done** (spine verified against real intervals.icu). **Phase 1 in
> progress**: the Expo app runs (`npm run mobile`) with a live Today screen, a
> subjective check-in, and an in-app lift logger, all backed by Supabase. See the plan
> in `.claude/plans/`.

## Layout

```
packages/core/   Pure-TS, framework-free, fully tested. THE shared logic:
                 dates (NZ bucketing), snapshot contract, intervals.icu client,
                 Technogym parser, bodycomp insights, strength model, verdict.
scripts/         Phase 0 verification scripts + scripts/db-seed.ts (Supabase seed).
fixtures/        Synthetic Technogym export, modelled on the real panel.
artifacts/       Generated snapshot.json (gitignored).
apps/mobile/     Expo app (web-first, native later). Today screen + design tokens.
supabase/        migrations/0001_init.sql — RLS-ready schema, single seeded user.
```

`packages/core` has no React Native or Deno dependencies on purpose: the Phase 0
scripts, the future Supabase edge functions, and the future Expo app all import the
*same tested code*, so what the script proves is what ships.

## Phase 0 — prove the spine

```bash
npm install
npm test          # 40 unit tests across core (dates, parser, strength, verdict, snapshot)
npm run typecheck
npm run verify    # the Phase 0 exit-criteria run (see below)
```

`npm run verify` does three things:

1. **intervals.icu coverage report** — pulls the last 30 days and prints, per field
   (CTL/ATL, HRV, sleep, resting HR, run load/pace/HR), how often this account actually
   populates it. This is the real go/no-go artifact. **Skipped** until you add
   `INTERVALS_API_KEY` to `.env` (copy `.env.example`).
2. **Technogym parse** — parses the export (synthetic fixture by default; pass a real
   ZIP via `npm run parse:technogym -- path/to.zip`) into a body-comp panel with
   per-metric NZ-local dates.
3. **Snapshot assembly** — composes the combined athlete snapshot the coach reads, and
   writes `artifacts/snapshot.json`.

Individual scripts:

```bash
npm run verify:intervals          # 0.1 — needs INTERVALS_API_KEY
npm run parse:technogym           # 0.2 — fixture
npm run parse:technogym -- x.zip  # 0.2 — real export
npm run build:snapshot            # 0.3 — assemble (live endurance if key present)
```

## What to give me to finish Phase 0

Just one thing: **`INTERVALS_API_KEY` + your athlete id** in `.env`. Get them from
intervals.icu in a **browser** → Settings (bottom of the page) → **Developer Settings**
(athlete id looks like `i123456`). Then `npm run verify` prints the live coverage report.

> Body composition does **not** need an export. Technogym has no clean self-serve export,
> so manual entry (typing the gym scale's panel) is the primary path — already built and
> tested. The ZIP importer remains only as an optional path if a GDPR data request ever
> returns usable data.

See the full plan and assumptions in `.claude/plans/`.

## Running the app

```bash
npm run mobile   # starts Expo web at http://localhost:8081
```

Best viewed narrow (F12 → device toolbar, ~400px width) — the design is phone-first.
The Today screen fetches the latest row from Supabase's `athlete_snapshot` table; if
Supabase isn't configured (or has no row yet) it falls back to a bundled sample and
says so in the top bar (`· SAMPLE`).

## Supabase setup

1. `supabase/migrations/0001_init.sql` — apply via the Supabase SQL editor (or
   `supabase db push` with the CLI). Creates the RLS-ready schema: one `athlete` profile
   row per user, plus activity/daily_metrics/checkin/exercise/routine/lift_session/
   set_log/strength_state/body_scan/nutrition/plan_session/athlete_snapshot/coach_message —
   all restricted to `auth.uid() = user_id`.
2. Add to `.env` (repo root): `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project
   Settings → API — service_role is admin-only, never ships to the app).
3. `npm run db:seed` (in `scripts/`) — creates the one seeded auth user + athlete
   profile + starter exercises. Single-user for now, but RLS is real (a genuine
   `auth.uid()`), so the app can grow to multi-user later with zero migration.
4. Add to `apps/mobile/.env` (a separate file — Expo loads env from the app root, not
   the monorepo root): `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   The app auto signs in as the seeded user on launch (no login screen yet).
5. `npm run build:snapshot --workspace scripts` — pulls intervals.icu, reads the
   athlete profile/logged lifts/body scans from Supabase, assembles the snapshot +
   deterministic readiness verdict via `@crucible/core`, and writes it as a new
   `athlete_snapshot` row. This is the pragmatic stand-in for the planned scheduled
   Deno edge function (Docker/CLI-linking friction on Windows) — same core logic,
   manually triggered instead of cron-scheduled. Swapping it for a real edge function
   later is a deployment change, not a logic change.

The app never runs `@crucible/core` at runtime itself for the bulk of the logic — only
TYPES are imported into the RN bundle (core's internal NodeNext ".js" specifiers resolve
fine under Node/tsx but not under Metro's bundler, and Metro here has
`unstable_enablePackageExports` disabled — see metro.config.js — so package.json subpath
exports don't help either). All snapshot assembly happens server-side in step 5; the app
just displays the resulting JSON.

**One deliberate exception:** `scoreReadiness` (`packages/core/src/verdict/score.ts`) and
`todayLocal` (`packages/core/src/dates/localDate.ts`) have zero runtime imports of their
own, so they're safe to bundle directly. The app reaches them via a `@core-direct/*`
tsconfig path alias straight into `packages/core/src` (`apps/mobile/tsconfig.json`),
bypassing both the barrel files and the package's `exports` map. This is what lets the
**subjective check-in** (`/checkin`) recompute the Green/Amber/Red verdict *instantly*
on-device the moment you tap save, rather than waiting on the next `build:snapshot` run —
while the check-in is still durably written to Supabase's `checkin` table so the next
server-side run picks it up too.

## What's in the app right now

- **Today** (`/`) — the verdict, both engine cards, recent runs, and entry points into
  the check-in and lift logger.
- **Check-in** (`/checkin`, modal) — tap what hurts + a severity stepper, pick an energy
  level (1–5). Saves to Supabase and updates the verdict instantly (see above).
- **Lift logger** (`/lift` → `/lift/session`) — pick a routine (`Push A` / `Pull B` /
  `Legs`, seeded by `db:seed`), log each set's weight/reps/RPE (auto-filled from your
  last session for that exercise), a 90s rest-timer chip after each logged set, and a
  finish button that closes out the session. Strength numbers on the Today screen update
  on the next `build:snapshot` run (the EWMA model needs the full lift history, so unlike
  the check-in it isn't safe to recompute on-device — see the architecture note above).

## Design notes baked into the spine

- **NZ date bucketing** (`packages/core/src/dates`): one `localCalendarDate(...,
  'Pacific/Auckland')` helper, used everywhere UTC instants become calendar days —
  the fix for the documented Technogym timezone trap. intervals.icu values are already
  local and are *not* re-converted.
- **Two comparable engines**: strength fitness/fatigue/freshness uses the *same* EWMA
  math (42d/7d) as endurance CTL/ATL/TSB, so the verdict compares like with like.
- **Deterministic verdict**: readiness is scored from numbers in
  `packages/core/src/verdict`; the LLM (added in Phase 1) only writes the rationale and
  picks the session adjustment — it never invents the numbers.
