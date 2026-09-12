-- Fix free plan: drafts should not count, race condition, and correct counting

-- Update free_ads_this_month to only count pending/approved (not draft/deleted)
create or replace function public.free_ads_this_month(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.ads
  where user_id = p_user
    and deleted_at is null
    and status in ('pending','approved')
    and created_at >= public.start_of_month_kolkata();
$$;

-- Fix trigger to handle draft correctly and prevent race with advisory lock
create or replace function public.enforce_free_plan_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if new.status in ('pending','approved') then
    -- Serialize per user to prevent 5 tabs submitting at once
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    select public.free_ads_this_month(new.user_id) into v_count;
    if v_count >= 3 then
      raise exception 'FREE_LIMIT_REACHED' using errcode = '45000', hint = 'You have reached your free limit of 3 ads for this month.';
    end if;
    if new.expires_at is null then
      new.expires_at := coalesce(new.created_at, now()) + interval '7 days';
    end if;
    if new.status = 'approved' and new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_free_plan_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if old.status = 'draft' and new.status in ('pending','approved') then
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    select public.free_ads_this_month(new.user_id) into v_count;
    if v_count >= 3 then
      raise exception 'FREE_LIMIT_REACHED' using errcode = '45000';
    end if;
    if new.expires_at is null then
      new.expires_at := coalesce(new.created_at, now()) + interval '7 days';
    end if;
    if new.status = 'approved' and new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;
