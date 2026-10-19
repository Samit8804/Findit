-- ============================================================
-- FindIt — Persist dashboard Settings toggles on the profile
-- Adds profiles.preferences jsonb. Existing RLS policies already
-- let owners read/update their own profile row. Idempotent.
-- ============================================================

alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;
