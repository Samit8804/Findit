-- ============================================================
-- FindIt — Plan-based messaging entitlements (₹149+ plans)
-- Run AFTER 0051. Idempotent.
--
-- Design:
--   * `promotions.messaging_access` is the explicit plan feature flag.
--   * A plan qualifies only when messaging_access = true AND its configured
--     price is at least the messaging price floor (₹149). Checkout discounts
--     never change this decision.
--   * Entitlement is derived from an active, non-expired user_subscriptions
--     row joined to its promotion — never from profiles.plan or client input.
--   * Admin / moderator / super_admin roles keep their existing bypass.
--   * Business subscriptions always record the plan; messaging access is
--     additionally required. Non-subscription promotions (e.g. Top Listing)
--     that qualify grant a time-limited messaging pass.
-- ============================================================

-- ---------- 1. Plan feature flag ----------
-- Backfill only when the column is first introduced, so re-running this
-- migration never overrides an admin's later decision to disable messaging.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'promotions'
      and column_name = 'messaging_access'
  ) then
    alter table public.promotions
      add column messaging_access boolean not null default false;

    update public.promotions
       set messaging_access = true
     where price >= 149;
  end if;
end $$;

-- Guard the floor in the database: a cheaper plan cannot claim messaging.
alter table public.promotions
  drop constraint if exists promotions_messaging_price_check;
alter table public.promotions
  add constraint promotions_messaging_price_check
  check (not messaging_access or price >= 149);

-- Centralised floor used by entitlement checks.
create or replace function public.messaging_min_price()
returns numeric
language sql
immutable
as $$ select 149::numeric $$;

-- ---------- 2. Single entitlement rule ----------
-- Staff bypass + active subscription to a configured ₹149+ messaging plan.
create or replace function public.has_active_messaging_subscription(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.profiles
    where id = p_user_id
      and role in ('moderator', 'admin', 'super_admin')
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.user_subscriptions us
    join public.promotions p on p.id = us.promotion_id
    where us.user_id = p_user_id
      and us.status = 'active'
      and (us.ends_at is null or us.ends_at > now())
      and p.messaging_access = true
      and p.price >= public.messaging_min_price()
  ) then
    return true;
  end if;

  -- Legacy business subscriptions recorded before promotion links existed.
  return exists (
    select 1
    from public.user_subscriptions us
    where us.user_id = p_user_id
      and us.promotion_id is null
      and us.status = 'active'
      and (us.ends_at is null or us.ends_at > now())
      and us.plan in ('business', 'business-pro')
  );
end;
$$;

-- Server-derived access details for UI (never accepts a user id from the client).
create or replace function public.get_my_messaging_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_staff boolean := false;
  v_plan_name text;
  v_legacy_plan text;
  v_expires_at timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object(
      'allowed', false,
      'isAdmin', false,
      'planName', null,
      'expiresAt', null,
      'reason', 'NOT_AUTHENTICATED'
    );
  end if;

  select exists (
    select 1 from public.profiles
    where id = v_uid
      and role in ('moderator', 'admin', 'super_admin')
  ) into v_staff;

  if v_staff then
    return jsonb_build_object(
      'allowed', true,
      'isAdmin', true,
      'planName', 'Administrator',
      'expiresAt', null,
      'reason', 'STAFF_ACCESS'
    );
  end if;

  select p.name, us.ends_at
    into v_plan_name, v_expires_at
  from public.user_subscriptions us
  join public.promotions p on p.id = us.promotion_id
  where us.user_id = v_uid
    and us.status = 'active'
    and (us.ends_at is null or us.ends_at > now())
    and p.messaging_access = true
    and p.price >= public.messaging_min_price()
  order by p.price desc, us.ends_at desc nulls last
  limit 1;

  -- Legacy business subscriptions recorded before promotion links existed.
  if v_plan_name is null then
    select us.plan, us.ends_at
      into v_legacy_plan, v_expires_at
    from public.user_subscriptions us
    where us.user_id = v_uid
      and us.promotion_id is null
      and us.status = 'active'
      and (us.ends_at is null or us.ends_at > now())
      and us.plan in ('business', 'business-pro')
    order by us.ends_at desc nulls last
    limit 1;

    if v_legacy_plan = 'business-pro' then
      v_plan_name := 'Business Pro';
    elsif v_legacy_plan = 'business' then
      v_plan_name := 'Business';
    end if;
  end if;

  return jsonb_build_object(
    'allowed', v_plan_name is not null,
    'isAdmin', false,
    'planName', v_plan_name,
    'expiresAt', v_expires_at,
    'reason', case when v_plan_name is null then 'NO_ACTIVE_PLAN' else 'ACTIVE_SUBSCRIPTION' end
  );
end;
$$;

-- ---------- 3. Profile plan derivation (display only) ----------
create or replace function public.derive_profile_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.user_subscriptions us
      join public.promotions p on p.id = us.promotion_id
      where us.user_id = p_user_id
        and us.status = 'active'
        and (us.ends_at is null or us.ends_at > now())
        and p.type = 'business_subscription'
        and p.slug = 'business-pro'
    ) then 'business-pro'
    when exists (
      select 1
      from public.user_subscriptions us
      where us.user_id = p_user_id
        and us.promotion_id is null
        and us.status = 'active'
        and (us.ends_at is null or us.ends_at > now())
        and us.plan = 'business-pro'
    ) then 'business-pro'
    when exists (
      select 1
      from public.user_subscriptions us
      join public.promotions p on p.id = us.promotion_id
      where us.user_id = p_user_id
        and us.status = 'active'
        and (us.ends_at is null or us.ends_at > now())
        and p.type = 'business_subscription'
    ) then 'business'
    when exists (
      select 1
      from public.user_subscriptions us
      where us.user_id = p_user_id
        and us.promotion_id is null
        and us.status = 'active'
        and (us.ends_at is null or us.ends_at > now())
        and us.plan in ('business', 'business-pro')
    ) then 'business'
    else 'free'
  end;
$$;

-- ---------- 4. Verified-payment activation (idempotent, renewal-safe) ----------
-- Called only by complete_paid_order after the order transitions to paid.
-- Extends the existing active row for the same plan instead of creating
-- duplicates, and always extends from max(current expiry, now()).
create or replace function public.apply_paid_subscription(
  p_user_id uuid,
  p_promotion_id uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo public.promotions%rowtype;
  v_sub_id uuid;
  v_sub_ends timestamptz;
  v_ends timestamptz;
  v_plan text;
  v_lock uuid;
begin
  select * into v_promo from public.promotions where id = p_promotion_id;
  if v_promo.id is null then
    return;
  end if;

  -- Business subscriptions always record the plan. Other products only
  -- create a messaging pass when the plan explicitly includes messaging.
  if v_promo.type <> 'business_subscription'
     and not (v_promo.messaging_access and v_promo.price >= public.messaging_min_price()) then
    return;
  end if;

  -- Serialize grants per user so concurrent callbacks cannot insert duplicates.
  select id into v_lock from public.profiles where id = p_user_id for update;

  v_plan := case
    when v_promo.type = 'business_subscription'
      then (case when v_promo.slug = 'business-pro' then 'business-pro' else 'business' end)
    else coalesce(v_promo.plan_type, v_promo.slug)
  end;

  select id, ends_at
    into v_sub_id, v_sub_ends
  from public.user_subscriptions
  where user_id = p_user_id
    and promotion_id = p_promotion_id
    and status = 'active'
  order by ends_at desc nulls last
  limit 1
  for update;

  v_ends := greatest(coalesce(v_sub_ends, now()), now())
            + (coalesce(v_promo.duration_days, 30) || ' days')::interval;

  if v_sub_id is not null then
    update public.user_subscriptions
       set status = 'expired'
     where user_id = p_user_id
       and promotion_id = p_promotion_id
       and status = 'active'
       and id <> v_sub_id;

    update public.user_subscriptions
       set plan = v_plan,
           order_id = p_order_id,
           ends_at = v_ends,
           status = 'active'
     where id = v_sub_id;
  else
    insert into public.user_subscriptions
      (user_id, promotion_id, order_id, plan, starts_at, ends_at, status)
    values
      (p_user_id, p_promotion_id, p_order_id, v_plan, now(), v_ends, 'active');
  end if;

  if v_promo.type = 'business_subscription' then
    update public.profiles
       set plan = public.derive_profile_plan(p_user_id)
     where id = p_user_id;
  end if;
end;
$$;

-- ---------- 4b. Refund / cancellation revocation ----------
create or replace function public.revoke_subscription_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.orders where id = p_order_id;

  update public.user_subscriptions
     set status = 'cancelled',
         ends_at = least(coalesce(ends_at, now()), now())
   where order_id = p_order_id
     and status = 'active';

  if v_user is not null then
    update public.profiles
       set plan = public.derive_profile_plan(v_user)
     where id = v_user;
  end if;
end;
$$;

-- Collapse legacy duplicate active rows (0028 inserted a new row per renewal).
with ranked as (
  select id,
         row_number() over (
           partition by user_id, promotion_id, plan
           order by (ends_at is null) desc, ends_at desc, created_at desc
         ) as rn
  from public.user_subscriptions
  where status = 'active'
)
update public.user_subscriptions us
   set status = 'expired'
  from ranked r
 where us.id = r.id
   and r.rn > 1;

-- Existing qualifying ad promotions (notably Top Listing) become messaging
-- passes for their remaining active period. One row per user + plan.
insert into public.user_subscriptions
  (user_id, promotion_id, order_id, plan, starts_at, ends_at, status)
select o.user_id,
       ap.promotion_id,
       (array_agg(ap.order_id order by ap.ends_at desc nulls last))[1],
       coalesce(p.plan_type, p.slug),
       min(ap.starts_at),
       max(ap.ends_at),
       'active'
from public.ad_promotions ap
join public.orders o on o.id = ap.order_id
join public.promotions p on p.id = ap.promotion_id
where ap.status = 'active'
  and ap.ends_at is not null
  and ap.ends_at > now()
  and p.messaging_access = true
  and p.price >= public.messaging_min_price()
  and p.type <> 'business_subscription'
  and not exists (
    select 1
    from public.user_subscriptions us
    where us.user_id = o.user_id
      and us.promotion_id = ap.promotion_id
      and us.status = 'active'
  )
group by o.user_id, ap.promotion_id, p.plan_type, p.slug;

-- ---------- 5. Expiry + plan refresh ----------
create or replace function public.expire_user_subscriptions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  for v_user in
    select distinct user_id
    from public.user_subscriptions
    where status = 'active'
      and ends_at is not null
      and ends_at <= now()
  loop
    update public.user_subscriptions
       set status = 'expired'
     where user_id = v_user
       and status = 'active'
       and ends_at is not null
       and ends_at <= now();

    update public.profiles
       set plan = public.derive_profile_plan(v_user)
     where id = v_user;
  end loop;

  -- Repair stale plan labels for anyone with subscription history.
  update public.profiles p
     set plan = public.derive_profile_plan(p.id)
   where exists (
     select 1 from public.user_subscriptions us where us.user_id = p.id
   );
end;
$$;

do $$
declare
  v_job bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job from cron.job where jobname = 'expire-user-subscriptions-hourly';
    if v_job is not null then
      perform cron.unschedule(v_job);
    end if;
    perform cron.schedule(
      'expire-user-subscriptions-hourly',
      '17 * * * *',
      $cron$select public.expire_user_subscriptions();$cron$
    );
  end if;
exception when others then
  raise notice 'Skipping messaging subscription cron setup: %', sqlerrm;
end $$;

-- ---------- 6. complete_paid_order: activate only after verified payment ----------
-- Same verified lifecycle as 0028, plus subscription recording. Only the
-- service role may execute this function (see grants at the end).
create or replace function public.complete_paid_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_provider text default 'razorpay',
  p_amount numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ord record;
  promo record;
  v_ad record;
  v_target_expiry timestamptz;
  v_new_expires_at timestamptz;
  v_ends_at timestamptz;
  activated boolean := false;
begin
  select * into ord
  from public.orders
  where id = p_order_id
  for update;

  if ord.id is null then
    return false;
  end if;

  if ord.status not in ('created', 'pending') then
    return false;
  end if;

  if ord.provider is distinct from p_provider then
    return false;
  end if;

  if p_amount is not null and ord.amount is distinct from p_amount then
    return false;
  end if;

  select * into promo
  from public.promotions
  where id = ord.promotion_id;

  if promo.id is null
     or ord.amount is distinct from promo.price
     or ord.currency is distinct from promo.currency then
    return false;
  end if;

  if promo.type = 'boost' or promo.plan_type = 'boost_3d' then
    if promo.slug <> 'boost_3d'
       or promo.type <> 'boost'
       or promo.price <> 49
       or promo.currency <> 'INR'
       or promo.duration_days <> 3
       or ord.ad_id is null then
      return false;
    end if;

    select * into v_ad
    from public.ads
    where id = ord.ad_id
    for update;

    if v_ad.id is null
       or not (public.check_boost_eligibility(v_ad.id, ord.user_id)->>'eligible')::boolean then
      return false;
    end if;
  elsif promo.type = 'extension' or promo.plan_type = 'extend_10d' then
    if promo.slug <> 'extend_10d'
       or promo.type <> 'extension'
       or promo.price <> 59
       or promo.currency <> 'INR'
       or promo.duration_days <> 10
       or ord.ad_id is null then
      return false;
    end if;

    select * into v_ad
    from public.ads
    where id = ord.ad_id
    for update;

    if v_ad.id is null
       or not (public.check_extension_eligibility(v_ad.id, ord.user_id)->>'eligible')::boolean then
      return false;
    end if;
  end if;

  update public.orders
     set status = 'paid',
         paid_at = now(),
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         updated_at = now()
   where id = p_order_id
     and status in ('created', 'pending')
     and (p_amount is null or amount = p_amount)
   returning * into ord;

  if ord.id is null then
    return false;
  end if;

  if p_provider_payment_id is not null then
    insert into public.payment_transactions (order_id, provider, provider_transaction_id, amount, currency, status)
    values (ord.id, p_provider, p_provider_payment_id, ord.amount, ord.currency, 'success')
    on conflict (provider, provider_transaction_id) do nothing;
  end if;

  if promo.type = 'boost' and promo.plan_type = 'boost_3d' and ord.ad_id is not null then
    select * into v_ad
    from public.ads
    where id = ord.ad_id
    for update;

    if v_ad.id is null then
      raise exception 'Advertisement not found' using errcode = '45000';
    end if;

    if v_ad.expires_at is null then
      raise exception 'No expiry date set - cannot determine eligibility' using errcode = '45000';
    end if;

    v_ends_at := now() + (promo.duration_days || ' days')::interval;

    insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
    values (ord.ad_id, ord.promotion_id, ord.id, now(), v_ends_at, 'active', promo.plan_type)
    on conflict (order_id) do nothing;

    activated := true;

    perform public.notify_user(
      ord.user_id,
      'boost_activated',
      'Your 3-day Boost is now active!',
      'Your advertisement is now boosted for 3 days.',
      jsonb_build_object('ad_id', ord.ad_id, 'order_id', ord.id)
    );

    perform public.notify_user(
      ord.user_id,
      'payment_success',
      'Payment successful',
      left(promo.name || ' — ₹' || ord.amount::text, 80),
      jsonb_build_object('order_id', ord.id)
    );

  elsif promo.type = 'extension' and promo.plan_type = 'extend_10d' and ord.ad_id is not null then
    select * into v_ad
    from public.ads
    where id = ord.ad_id
    for update;

    if v_ad.id is null then
      raise exception 'Advertisement not found' using errcode = '45000';
    end if;

    if v_ad.expires_at is null then
      raise exception 'No expiry date set - cannot determine eligibility' using errcode = '45000';
    end if;

    v_target_expiry := v_ad.created_at + interval '10 days';

    if v_ad.expires_at >= v_target_expiry then
      return false;
    end if;

    v_new_expires_at := greatest(v_ad.expires_at, v_target_expiry);
    v_ends_at := v_target_expiry;

    insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
    values (ord.ad_id, ord.promotion_id, ord.id, now(), v_ends_at, 'active', promo.plan_type)
    on conflict (order_id) do nothing;

    update public.ads
       set expires_at = v_new_expires_at,
           updated_at = now()
     where id = ord.ad_id;

    activated := true;

    perform public.notify_user(
      ord.user_id,
      'extension_activated',
      'Your listing has been extended to 10 days total.',
      'Your advertisement has been extended to 10 days from original creation.',
      jsonb_build_object('ad_id', ord.ad_id, 'order_id', ord.id)
    );

    perform public.notify_user(
      ord.user_id,
      'payment_success',
      'Payment successful',
      left(promo.name || ' — ₹' || ord.amount::text, 80),
      jsonb_build_object('order_id', ord.id)
    );

  elsif promo.type in ('featured', 'top') and ord.ad_id is not null then
    v_ends_at := now() + (promo.duration_days || ' days')::interval;

    insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
    values (ord.ad_id, ord.promotion_id, ord.id, now(), v_ends_at, 'active', promo.plan_type)
    on conflict (order_id) do update
      set status = 'active',
          starts_at = now(),
          ends_at = v_ends_at,
          plan_type = promo.plan_type;

    update public.ads
       set is_featured = true,
           updated_at = now()
     where id = ord.ad_id;

    activated := true;

    perform public.notify_user(
      ord.user_id,
      'promotion_activated',
      promo.name || ' promotion is now active.',
      ord.ad_id::text,
      jsonb_build_object('ad_id', ord.ad_id, 'order_id', ord.id)
    );

    perform public.notify_user(
      ord.user_id,
      'payment_success',
      'Payment successful',
      left(promo.name || ' — ₹' || ord.amount::text, 80),
      jsonb_build_object('order_id', ord.id)
    );

  elsif promo.type = 'business_subscription' then
    activated := true;

    perform public.notify_user(
      ord.user_id,
      'payment_success',
      'Subscription activated',
      promo.name,
      jsonb_build_object('order_id', ord.id)
    );
  end if;

  -- Record/extend the paid subscription exactly when a verified order is paid.
  if activated then
    perform public.apply_paid_subscription(ord.user_id, ord.promotion_id, ord.id);
  end if;

  return true;
end;
$$;

-- ---------- 7. Execution grants ----------
-- Clients must never be able to mint paid orders or subscriptions directly.
revoke all on function public.complete_paid_order(uuid, text, text, numeric) from public;
revoke all on function public.complete_paid_order(uuid, text, text, numeric) from anon;
revoke all on function public.complete_paid_order(uuid, text, text, numeric) from authenticated;
grant execute on function public.complete_paid_order(uuid, text, text, numeric) to service_role;

revoke all on function public.has_active_messaging_subscription(uuid) from public;
revoke all on function public.has_active_messaging_subscription(uuid) from anon;
revoke all on function public.has_active_messaging_subscription(uuid) from authenticated;
grant execute on function public.has_active_messaging_subscription(uuid) to service_role;

revoke all on function public.apply_paid_subscription(uuid, uuid, uuid) from public;
revoke all on function public.apply_paid_subscription(uuid, uuid, uuid) from anon;
revoke all on function public.apply_paid_subscription(uuid, uuid, uuid) from authenticated;
grant execute on function public.apply_paid_subscription(uuid, uuid, uuid) to service_role;

revoke all on function public.derive_profile_plan(uuid) from public;
revoke all on function public.derive_profile_plan(uuid) from anon;
revoke all on function public.derive_profile_plan(uuid) from authenticated;
grant execute on function public.derive_profile_plan(uuid) to service_role;

revoke all on function public.expire_user_subscriptions() from public;
revoke all on function public.expire_user_subscriptions() from anon;
revoke all on function public.expire_user_subscriptions() from authenticated;
grant execute on function public.expire_user_subscriptions() to service_role;

revoke all on function public.revoke_subscription_for_order(uuid) from public;
revoke all on function public.revoke_subscription_for_order(uuid) from anon;
revoke all on function public.revoke_subscription_for_order(uuid) from authenticated;
grant execute on function public.revoke_subscription_for_order(uuid) to service_role;

revoke all on function public.messaging_min_price() from public;
revoke all on function public.messaging_min_price() from anon;
revoke all on function public.messaging_min_price() from authenticated;

revoke all on function public.get_my_messaging_access() from public;
revoke all on function public.get_my_messaging_access() from anon;
grant execute on function public.get_my_messaging_access() to authenticated;

-- Recompute stale plan labels for existing subscription holders.
do $$
declare
  v_user uuid;
begin
  for v_user in select distinct user_id from public.user_subscriptions loop
    update public.profiles
       set plan = public.derive_profile_plan(v_user)
     where id = v_user;
  end loop;
end $$;
