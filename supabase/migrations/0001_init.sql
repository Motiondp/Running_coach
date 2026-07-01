-- Crucible — initial schema.
--
-- Single-user for now (no login UI), but every table is keyed on user_id/auth.uid()
-- with row-level security from day one so it can grow to multi-user later with zero
-- migration. There is one real Supabase auth user (created by supabase/seed/seed.ts);
-- the app signs in as that user automatically rather than showing a login screen.
--
-- Apply via the Supabase SQL editor, or `supabase db push` if you use the CLI.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- athlete: one profile row per user (id = auth.users.id)
-- ---------------------------------------------------------------------------
create table athlete (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  timezone text not null default 'Pacific/Auckland',
  priority text not null default 'fat_loss' check (priority in ('fat_loss', 'muscle', 'race')),
  goal_race_name text,
  goal_race_distance_km numeric,
  goal_race_date date,
  goal_race_target_time text,
  bodycomp_target_weight numeric,
  bodycomp_target_fat_pct numeric,
  bodycomp_target_muscle numeric,
  constraints jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table injury (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  location text not null,
  severity int not null check (severity between 0 and 10),
  since date not null,
  resolved_at date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- endurance spine (intervals.icu) — read, never recompute CTL/ATL/TSB
-- ---------------------------------------------------------------------------
create table activity (
  id text primary key, -- intervals.icu activity id
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null, -- local calendar date
  type text,
  load numeric,
  distance_km numeric,
  avg_hr numeric,
  moving_time_secs numeric,
  pace numeric,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index activity_user_date_idx on activity (user_id, date desc);

create table daily_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  hrv numeric,
  hrv_sdnn numeric,
  sleep_secs numeric,
  sleep_score numeric,
  resting_hr numeric,
  ctl numeric,
  atl numeric,
  tsb numeric,
  raw jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------------
-- subjective check-in — the human signal
-- ---------------------------------------------------------------------------
create table checkin (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  energy int check (energy between 1 and 5),
  pain jsonb not null default '[]', -- [{ location, severity }]
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------------
-- strength: in-app lift logger
-- ---------------------------------------------------------------------------
create table exercise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  muscle_groups text[] not null default '{}',
  equipment text,
  created_at timestamptz not null default now()
);

create table routine (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]', -- ordered [{ exercise_id, target_sets, target_reps }]
  created_at timestamptz not null default now()
);

create table lift_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid references routine (id) on delete set null,
  date date not null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  created_at timestamptz not null default now()
);

create table set_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references lift_session (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references exercise (id) on delete restrict,
  weight numeric not null,
  reps int not null,
  rpe numeric,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index set_log_session_idx on set_log (session_id);

-- Computed cache mirroring packages/core/strength (EWMA fitness/fatigue/freshness).
-- Recomputed by the app/edge function whenever a set is logged; stored for fast reads.
create table strength_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  muscle_group text not null,
  tonnage_7d numeric not null default 0,
  freshness numeric not null default 0,
  last_trained date,
  computed_at timestamptz not null default now(),
  primary key (user_id, muscle_group)
);

-- ---------------------------------------------------------------------------
-- body composition — manual entry is the primary path (no clean Technogym export)
-- ---------------------------------------------------------------------------
create table body_scan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null, -- BodyCompMetric: weight | fat_pct | fat_mass | muscle | bmr | ffm | ...
  value numeric not null,
  unit text,
  date date not null, -- local calendar date the athlete attributes this reading to
  source text not null default 'manual' check (source in ('manual', 'technogym_zip')),
  created_at timestamptz not null default now()
);
create index body_scan_user_metric_date_idx on body_scan (user_id, metric, date desc);

-- ---------------------------------------------------------------------------
-- nutrition (Cronometer) — Phase 2
-- ---------------------------------------------------------------------------
create table nutrition (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  kcal numeric,
  protein numeric,
  carb numeric,
  fat numeric,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------------
-- plan engine — Phase 2
-- ---------------------------------------------------------------------------
create table plan_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  prescribed jsonb,
  adjusted jsonb,
  status text,
  rationale text,
  created_at timestamptz not null default now()
);
create index plan_session_user_date_idx on plan_session (user_id, date);

-- ---------------------------------------------------------------------------
-- coach — chat thread, each message pinned to the snapshot it was answered from
-- ---------------------------------------------------------------------------
create table athlete_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version int not null,
  local_date date not null,
  payload jsonb not null, -- the full AthleteSnapshot (packages/core/snapshot/types.ts)
  created_at timestamptz not null default now()
);
create index athlete_snapshot_user_date_idx on athlete_snapshot (user_id, local_date desc);

create table coach_message (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null default gen_random_uuid(),
  role text not null check (role in ('user', 'coach')),
  content text not null,
  snapshot_id uuid references athlete_snapshot (id) on delete set null,
  created_at timestamptz not null default now()
);
create index coach_message_thread_idx on coach_message (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- row-level security — every table restricted to its own user
-- ---------------------------------------------------------------------------
alter table athlete enable row level security;
alter table injury enable row level security;
alter table activity enable row level security;
alter table daily_metrics enable row level security;
alter table checkin enable row level security;
alter table exercise enable row level security;
alter table routine enable row level security;
alter table lift_session enable row level security;
alter table set_log enable row level security;
alter table strength_state enable row level security;
alter table body_scan enable row level security;
alter table nutrition enable row level security;
alter table plan_session enable row level security;
alter table athlete_snapshot enable row level security;
alter table coach_message enable row level security;

create policy athlete_self on athlete for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Every other table follows the same user_id = auth.uid() shape.
do $$
declare
  t text;
begin
  foreach t in array array[
    'injury', 'activity', 'daily_metrics', 'checkin', 'exercise', 'routine',
    'lift_session', 'set_log', 'strength_state', 'body_scan', 'nutrition',
    'plan_session', 'athlete_snapshot', 'coach_message'
  ]
  loop
    execute format(
      'create policy %I_self on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t, t
    );
  end loop;
end $$;
