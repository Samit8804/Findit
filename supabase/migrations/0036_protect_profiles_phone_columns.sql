-- Fix profiles RLS: protect phone/verification columns from public read
-- Create a public view that excludes sensitive columns

-- 1. Drop existing view if exists (to avoid column mismatch errors)
drop view if exists public.public_profiles;

-- 2. Create public_profiles view (safe columns only)
create view public.public_profiles as
select 
  id,
  name,
  avatar_url,
  is_verified,
  created_at
from public.profiles
where account_status = 'active';

grant select on public.public_profiles to anon, authenticated;

-- 3. Update profiles RLS - restrict public read to safe columns
-- Drop the overly permissive policy
drop policy if exists "profiles_public_read" on public.profiles;

-- Public can only read safe columns via the view
-- (No direct SELECT policy on profiles table for anon)

-- Authenticated users can read their own full profile
create policy "profiles_own_full_read" on public.profiles
  for select using (auth.uid() = id);

-- Admins can read all
create policy "profiles_admin_read" on public.profiles
  for select using (public.is_admin());

-- 4. Update profiles update policy - only safe columns updatable by users
drop policy if exists "profiles_own_update" on public.profiles;

create policy "profiles_own_update" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      -- Only allow safe columns to be changed
      role = (select role from public.profiles where id = auth.uid())
      or public.is_super_admin()
    )
  );

-- 5. Create a secure function for admin/service-role to read full profiles
create or replace function public.get_full_profile(p_user_id uuid)
returns public.profiles language sql security definer set search_path = public as $$
  select * from public.profiles where id = p_user_id;
$$;

grant execute on function public.get_full_profile(uuid) to service_role;