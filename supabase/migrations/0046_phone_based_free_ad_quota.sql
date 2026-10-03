-- Phone-based Free Ad Quota Implementation
-- Implements 3 free ads per verified phone number per calendar month (Asia/Kolkata)
-- Quota is shared across all accounts that verify the same phone number

-- 1. Helper: normalize phone for consistent comparison
create or replace function public.normalize_indian_phone(p_phone text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_phone is null then null
    else regexp_replace(
      case
        when trim(p_phone) ~ '^[6-9][0-9]{9}$' then '+91' || trim(p_phone)
        when trim(p_phone) ~ '^91[6-9][0-9]{9}$' then '+' || trim(p_phone)
        else trim(p_phone)
      end,
      '[\s\-\(\)]', '', 'g'
    )
  end;
$$;

-- 2. Get user's verified phone (normalized)
create or replace function public.get_user_verified_phone(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select public.normalize_indian_phone(phone)
  from public.profiles
  where id = p_user and phone_verified = true and phone is not null;
$$;

-- 3. Check if user has an active paid plan/subscription
create or replace function public.has_active_paid_plan(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.plan != 'free'
      and p.plan is not null
  )
  or exists (
    select 1 from public.user_subscriptions s
    where s.user_id = p_user
      and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

-- 4. Get verified phone for a user (returns null if not verified)
create or replace function public.get_verified_phone_for_user(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select public.normalize_indian_phone(phone)
  from public.profiles
  where id = p_user and phone_verified = true and phone is not null;
$$;

-- 5. Count free ads for a verified phone in current month
-- This is the authoritative quota function
create or replace function public.free_ads_this_month_by_phone(p_phone text)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.ads a
  join public.profiles p on p.id = a.user_id
  where public.normalize_indian_phone(p.phone) = p_phone
    and p.phone_verified = true
    and a.deleted_at is null
    and a.status in ('pending', 'approved')
    and a.created_at >= public.start_of_month_kolkata();
$$;

-- 6. Get free ad usage for a user (based on their verified phone)
-- Returns: used count, remaining, limit, verified phone, eligible
create or replace function public.get_free_ad_usage_for_user(p_user uuid)
returns table (
  verified_phone text,
  used int,
  remaining int,
  limit int,
  eligible boolean,
  is_paid boolean
) language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_used int;
  v_is_paid boolean;
  v_limit int := 3;
begin
  v_is_paid := public.has_active_paid_plan(p_user);
  
  if v_is_paid then
    return query select 
      null::text as verified_phone,
      0 as used,
      v_limit as remaining,
      v_limit as limit,
      true as eligible,
      true as is_paid;
  end if;

  -- Get user's verified phone
  select public.get_verified_phone_for_user(p_user) into v_phone;
  
  if v_phone is null then
    return query select 
      null::text as verified_phone,
      0 as used,
      0 as remaining,
      v_limit as limit,
      false as eligible,
      false as is_paid;
  end if;

  -- Count free ads for this phone
  select public.free_ads_this_month_by_phone(v_phone) into v_used;
  
  return query select 
    v_phone as verified_phone,
    v_used as used,
    greatest(v_limit - v_used, 0) as remaining,
    v_limit as limit,
    (v_used < v_limit) as eligible,
    false as is_paid;
end;
$$;

-- 7. Update free_ads_this_month to use phone-based quota (for backward compatibility)
-- This will be called by existing triggers
create or replace function public.free_ads_this_month(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((
    select used from public.get_free_ad_usage_for_user(p_user)
  ), 0);
$$;

-- 7b. New function for phone-based quota (explicit API)
-- Already created as free_ads_this_month_by_phone above

-- 8. Update enforce_free_plan_on_insert to use phone-based quota
create or replace function public.enforce_free_plan_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_is_free boolean := true;
  v_usage record;
begin
  if new.status in ('pending', 'approved') then
    -- Check if this is a free ad (no active promotion yet)
    select exists(select 1 from public.ad_promotions where ad_id = new.id and status = 'active') into v_is_free;
    
    -- For new ads, ad_promotions won't exist yet, so we check if user has paid plan
    -- If user has paid plan, skip free limit
    if not public.has_active_paid_plan(new.user_id) then
      select used into v_count from public.get_free_ad_usage_for_user(new.user_id);
      if v_count >= 3 then
        raise exception 'FREE_LIMIT_REACHED' using errcode = '45000', hint = 'Your free tier is complete. Buy a subscription to post more ads.';
      end if;
      -- Set 7-day expiry for free ads if not already set
      if new.expires_at is null then
        new.expires_at := coalesce(new.created_at, now()) + interval '7 days';
      end if;
      if new.status = 'approved' and new.published_at is null then
        new.published_at := now();
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 9. Update enforce_free_plan_on_update to use phone-based quota
create or replace function public.enforce_free_plan_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_usage record;
begin
  if old.status = 'draft' and new.status in ('pending', 'approved') then
    -- Skip free limit if user has active paid plan
    if not public.has_active_paid_plan(new.user_id) then
      select used into v_count from public.get_free_ad_usage_for_user(new.user_id);
      -- The current ad was draft and is now being published, so it will be counted
      -- We need to check if this publish would exceed the limit
      if v_count >= 3 then
        raise exception 'FREE_LIMIT_REACHED' using errcode = '45000', hint = 'Your free tier is complete. Buy a subscription to post more ads.';
      end if;
      if new.expires_at is null then
        new.expires_at := coalesce(new.created_at, now()) + interval '7 days';
      end if;
      if new.status = 'approved' and new.published_at is null then
        new.published_at := now();
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 10. Ensure the phone verification flow doesn't block already-verified phones
-- The create_phone_verification_session already checks is_phone_verified_by_another
-- But we need to ensure it allows verification even if phone was used before (quota sharing)
-- The verify_phone_session already has this check, but we should make it consistent
-- The existing behavior is correct - it allows verification, quota is checked at ad creation time

-- 11. Add index for phone-based quota lookups
create index if not exists idx_ads_user_created_status_deleted 
  on public.ads (user_id, created_at, status, deleted_at);