-- Editable weekly plan template, stored as a JSONB map of weekday (0=Sun..6=Sat) →
-- PlannedSession on the athlete row. Kept on `athlete` rather than a new table to
-- avoid extra RLS/grants surface — it's a single small object, one row per athlete,
-- and the app always merges it over the built-in default for any missing days.
alter table athlete add column if not exists plan_template jsonb;
