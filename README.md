# Crucible

Personal AI coaching app for a hybrid athlete (endurance + strength) chasing a race
goal *and* a body-composition goal at once. It eliminates manual data entry: pulls
training/recovery/body/nutrition data in automatically, captures the two signals
machines can't see (subjective readiness + pain), and resolves **both load engines into
one daily Green/Amber/Red verdict**.

> Status: **Phase 0 — proving the data spine.** No app UI yet, by design (see the plan
> in `.claude/plans/`). Phases 1–4 build the daily loop, lift logger, plan engine, body
> comp, and polish on top of this verified spine.

## Layout

```
packages/core/   Pure-TS, framework-free, fully tested. THE shared logic:
                 dates (NZ bucketing), snapshot contract, intervals.icu client,
                 Technogym parser, bodycomp insights, strength model, verdict.
scripts/         Phase 0 verification scripts (run against real intervals.icu + fixtures).
fixtures/        Synthetic Technogym export, modelled on the real panel.
artifacts/       Generated snapshot.json (gitignored).
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
