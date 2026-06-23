-- =============================================================================
-- Migration: audit_fixes_storage_rls
-- Created:   2026-06-23
-- Purpose:   [H3] Harden storage 'themes' bucket (service-role write-only) and
--            create public.theme_gen_log for IP-based rate-limiting (used by C1).
-- IMPORTANT: Do NOT apply this migration manually — run via Supabase CLI or
--            dashboard migrations panel. The file is idempotent (safe to re-run).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. theme_gen_log: per-IP-per-day generation counter
--    Used by the generate-theme Edge Function to enforce MAX_GEN_PER_IP_PER_DAY.
--    Only the service_role key (bypasses RLS) may read/write this table.
--    No anon or authenticated policies are added here intentionally.
-- ---------------------------------------------------------------------------

create table if not exists public.theme_gen_log (
  ip    text not null,
  day   date not null,
  count int  not null default 0,
  primary key (ip, day)
);

-- Enable RLS — no policies for anon/authenticated means they cannot access.
-- The Edge Function uses the service_role key which bypasses RLS entirely.
alter table public.theme_gen_log enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Storage RLS for the 'themes' bucket
--    Goal:
--      - Public READ for everyone (needed to serve GLB files to browsers)
--      - NO insert / update / delete for anon or authenticated roles
--        (only the service_role key used inside the Edge Function can write)
--
--    Strategy: drop-then-recreate makes the script idempotent on re-runs.
--    We only add a SELECT policy; the absence of write policies is the control.
-- ---------------------------------------------------------------------------

-- Public read policy (drop-then-create for idempotency)
drop policy if exists "themes_public_read" on storage.objects;

create policy "themes_public_read"
  on storage.objects
  for select
  to public                          -- covers anon, authenticated, and unauthenticated
  using (bucket_id = 'themes');

-- Explicitly ensure no anon/authenticated write policies exist.
-- These drops are safe no-ops if the policies were never created.
drop policy if exists "themes_anon_insert"         on storage.objects;
drop policy if exists "themes_anon_update"         on storage.objects;
drop policy if exists "themes_anon_delete"         on storage.objects;
drop policy if exists "themes_authenticated_insert" on storage.objects;
drop policy if exists "themes_authenticated_update" on storage.objects;
drop policy if exists "themes_authenticated_delete" on storage.objects;

-- Note: service_role bypasses RLS by design in Supabase/PostgreSQL, so the
-- Edge Function's supabase client (initialised with SUPABASE_SERVICE_ROLE_KEY)
-- can still upload GLB files without any explicit write policy.

-- ---------------------------------------------------------------------------
-- 3. Atomic increment function for IP rate-limiting (C1 fix)
--
--    public.increment_theme_gen(p_ip, p_day) → integer
--      Inserts a new row with count=1, or increments count by 1 atomically
--      using INSERT … ON CONFLICT DO UPDATE SET count = count + 1.
--      Returns the NEW count after the increment.
--
--    security definer: runs as the function owner (postgres / superuser) so it
--    can always write to theme_gen_log regardless of the caller's role.
--    grant execute to service_role so the Edge Function's service-role client
--    can call it via rpc(); anon/authenticated are NOT granted execute.
--
--    The CREATE OR REPLACE makes the migration idempotent on re-runs.
-- ---------------------------------------------------------------------------

create or replace function public.increment_theme_gen(p_ip text, p_day date)
returns integer language sql security definer as $$
  insert into public.theme_gen_log(ip, day, count)
  values (p_ip, p_day, 1)
  on conflict (ip, day)
  do update set count = public.theme_gen_log.count + 1
  returning count;
$$;

-- Grant execute only to service_role (used by the Edge Function).
-- Revoke from public/anon first to be explicit.
revoke execute on function public.increment_theme_gen(text, date) from public;
grant  execute on function public.increment_theme_gen(text, date) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Recommended maintenance (comment only — no pg_cron required)
--
--    theme_gen_log retention:
--      Rows older than 30 days are safe to delete; they are no longer needed
--      for rate-limiting. Suggested cleanup query (schedule with pg_cron or
--      run periodically via a maintenance function):
--
--        delete from public.theme_gen_log where day < current_date - interval '30 days';
--
--    themes storage lifecycle:
--      Generated AI themes accumulate in the 'themes' bucket. Consider adding
--      a cleanup routine (e.g., a scheduled Edge Function or pg_cron job) that:
--        - Lists objects under the 'themes/' prefix older than N days.
--        - Deletes them via supabase.storage.from('themes').remove([...paths]).
--      This prevents unbounded storage costs from abandoned/failed generations.
--
--    These are recommendations only. No automation is provisioned here.
-- ---------------------------------------------------------------------------
