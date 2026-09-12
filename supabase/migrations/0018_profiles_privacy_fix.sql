-- Fix critical privacy: profiles had USING(true) allowing anyone to SELECT * including phone/email/role
-- Replace with least-privilege policies + safe public view

-- 1. Remove unrestricted public read
drop policy if exists "profiles_public_read" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;

-- 2. Owner can read own complete profile (private fields)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select
  to authenticated using (auth.uid() = id);

-- 3. Admin/moderator can read all profiles for moderation
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles for select
  to authenticated using (public.is_moderator() or public.is_admin());

-- 4. Safe public view: only explicitly public fields
-- Include is_verified for verified badge (public), but not phone/email/role
create or replace view public.public_profiles with (security_invoker = false) as
select id, name, avatar_url, created_at, is_verified from public.profiles;

-- View is definer: it runs as view owner (postgres) and bypasses RLS on base, but only exposes safe columns
revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

-- Helper to safely get contact phone only if ad allows it and ad is approved
create or replace function public.get_ad_contact_phone(p_ad_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when a.contact_show_phone and a.status='approved' and a.deleted_at is null and (a.expires_at is null or a.expires_at > now())
    then p.phone else null end
  from public.ads a join public.profiles p on p.id = a.user_id
  where a.id = p_ad_id;
$$;
revoke all on function public.get_ad_contact_phone(uuid) from public;
grant execute on function public.get_ad_contact_phone(uuid) to anon, authenticated;

-- Ensure base table still has no public USING(true)
-- Already dropped, now only owner + admin can select base

-- Keep existing update policy but ensure it cannot change protected fields via trigger guard
-- The guard_profile_verified_v2 trigger already blocks phone_verified/role for non-moderators
-- Ensure with check also blocks role escalation (already in 0015)
-- No change to update policy here, trigger is defense in depth

-- Harden SECURITY DEFINER functions: ensure search_path and auth checks
-- verify_own_phone already has SECURITY DEFINER set search_path = public and checks auth.uid()
-- Ensure its execute is only for authenticated, not anon
revoke all on function public.verify_own_phone(text) from public;
grant execute on function public.verify_own_phone(text) to authenticated;

revoke all on function public.is_phone_verified(uuid) from public;
grant execute on function public.is_phone_verified(uuid) to authenticated;

revoke all on function public.free_ads_this_month(uuid) from public;
grant execute on function public.free_ads_this_month(uuid) to authenticated;

revoke all on function public.start_of_month_kolkata() from public;
grant execute on function public.start_of_month_kolkata() to authenticated, anon;

-- Also harden other sensitive SECURITY DEFINER funcs if they exist
do $$ begin
  if exists (select 1 from pg_proc where proname = 'complete_paid_order') then
    revoke all on function public.complete_paid_order(uuid, text, text, numeric) from public;
    grant execute on function public.complete_paid_order(uuid, text, text, numeric) to authenticated;
  end if;
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    revoke all on function public.is_admin() from public;
    grant execute on function public.is_admin() to authenticated, anon;
  end if;
  if exists (select 1 from pg_proc where proname = 'is_moderator') then
    revoke all on function public.is_moderator() from public;
    grant execute on function public.is_moderator() to authenticated, anon;
  end if;
end $$;
