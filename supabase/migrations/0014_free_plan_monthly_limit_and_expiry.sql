-- Free plan: 3 ads per calendar month (Asia/Kolkata), 7-day expiry for free ads
-- Timezone: Asia/Kolkata (UTC+5:30) — consistent for monthly reset

-- Ensure expires_at exists (already in 0001, but idempotent)
alter table public.ads add column if not exists expires_at timestamptz;
alter table public.ads add column if not exists published_at timestamptz;

-- Helper: start of current calendar month in Asia/Kolkata
create or replace function public.start_of_month_kolkata()
returns timestamptz language sql stable as $$
  select ((date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) at time zone 'Asia/Kolkata'))::timestamptz;
$$;

-- Helper: count free ads this month for a user (excludes deleted)
create or replace function public.free_ads_this_month(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.ads
  where user_id = p_user
    and deleted_at is null
    and created_at >= public.start_of_month_kolkata();
$$;

-- Trigger to enforce 3/month for free (non-promoted) and set 7-day expiry
create or replace function public.enforce_free_plan_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_is_free boolean := true;
begin
  -- Check if this is a free ad (no active promotion yet; we consider free if no ad_promotions active)
  -- For insert, we enforce only if status in ('pending','approved') and is not already promoted via ad_promotions
  -- Simpler: enforce for all inserts where status != 'draft' and no promotion exists yet
  if new.status in ('pending','approved') then
    -- Check if user already has an active promotion for this ad (paid) — if so, skip free limit
    select exists(select 1 from public.ad_promotions where ad_id = new.id and status = 'active') into v_is_free;
    -- Actually for new ad, ad_id not yet in ad_promotions, so is_free = true
    -- Count this month
    select public.free_ads_this_month(new.user_id) into v_count;
    if v_count >= 3 then
      raise exception 'FREE_LIMIT_REACHED' using errcode = '45000', hint = 'You have reached your free limit of 3 ads for this month.';
    end if;
    -- Set 7-day expiry for free ads if not already set
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

drop trigger if exists trg_enforce_free_plan on public.ads;
create trigger trg_enforce_free_plan before insert on public.ads for each row execute function public.enforce_free_plan_on_insert();

-- Also handle status change to pending/approved (publish) for monthly limit
create or replace function public.enforce_free_plan_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if old.status = 'draft' and new.status in ('pending','approved') then
    select public.free_ads_this_month(new.user_id) into v_count;
    -- Subtract 1 because the current row is already counted but was draft before
    -- So if count >3, it means this publish would exceed
    if v_count > 3 then
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

drop trigger if exists trg_enforce_free_plan_update on public.ads;
create trigger trg_enforce_free_plan_update before update of status on public.ads for each row execute function public.enforce_free_plan_on_update();

-- Ensure public queries exclude expired (already done via expires_at > now() in listPublicAds)
-- Add index for expiry checks
create index if not exists idx_ads_expires_at on public.ads(expires_at) where deleted_at is null and status = 'approved';

-- View helper for admin: real counts per status including expired
create or replace view public.admin_ad_counts as
select
  count(*) filter (where deleted_at is null) as total,
  count(*) filter (where status='pending' and deleted_at is null) as pending,
  count(*) filter (where status='approved' and deleted_at is null and (expires_at is null or expires_at > now())) as approved_active,
  count(*) filter (where status='approved' and deleted_at is null and expires_at <= now()) as expired,
  count(*) filter (where status='rejected' and deleted_at is null) as rejected,
  count(*) filter (where status='suspended' and deleted_at is null) as suspended,
  count(*) filter (where status='sold' and deleted_at is null) as sold,
  count(*) filter (where status='draft' and deleted_at is null) as draft
from public.ads;
