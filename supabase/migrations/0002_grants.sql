-- Explicit privilege grants.
--
-- RLS policies control WHICH ROWS a role can see; they don't grant access to the
-- TABLE itself. Some Supabase projects don't auto-grant privileges on tables created
-- via raw SQL (only via the Table Editor UI), which surfaces as "permission denied
-- for table X" even with a correct service_role/secret key. This grants access to the
-- tables (RLS policies still gate individual rows) and covers future tables too.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
