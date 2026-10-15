-- Expose only the fields used by public seller pages; keep private fields behind RLS.
create or replace view public.public_profiles with (security_invoker = false) as
select
  id,
  name,
  avatar_url,
  is_verified,
  created_at,
  username,
  display_name,
  bio,
  location_text,
  phone_verified,
  email_verified,
  business_verified,
  account_type
from public.profiles
where account_status = 'active';

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

-- Public visitors only need verified business display fields. Owners retain
-- access to their complete business profile through the base table.
create or replace view public.public_business_profiles with (security_invoker = false) as
select
  id,
  user_id,
  business_name,
  business_slug,
  business_category,
  verification_status,
  business_logo
from public.business_profiles as business
where verification_status = 'verified'
  and exists (
    select 1
    from public.profiles as profile
    where profile.id = business.user_id
      and profile.account_status = 'active'
  );

revoke all on public.public_business_profiles from public;
grant select on public.public_business_profiles to anon, authenticated;

drop policy if exists "business_public_read" on public.business_profiles;
drop policy if exists "business_owner_read" on public.business_profiles;
create policy "business_owner_read" on public.business_profiles
  for select to authenticated using (
    auth.uid() = user_id or public.is_moderator() or public.is_admin()
  );
