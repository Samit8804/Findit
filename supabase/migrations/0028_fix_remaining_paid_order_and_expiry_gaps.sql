-- ============================================================
-- FindIt — Final gap fixes for paid order completion, boost/extension validation,
-- and expiry notifications/cron safety.
-- Safe forward migration: does not rewrite already-applied history.
-- ============================================================

alter table public.notifications
add column if not exists related_ad_id uuid references public.ads (id) on delete set null;

alter table public.notifications
  add column if not exists data jsonb default '{}'::jsonb;

alter table public.notifications
add column if not exists expiry_cycle timestamptz;

create unique index if not exists uniq_notification_per_cycle
  on public.notifications (user_id, related_ad_id, type, expiry_cycle)
  where type in ('expiring_soon', 'expired');

create or replace function public.check_boost_eligibility(p_ad_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad record;
  v_remaining_seconds bigint;
  v_remaining_days int;
  v_now timestamptz := now();
begin
  select id, user_id, expires_at, status, deleted_at
    into v_ad
  from public.ads
  where id = p_ad_id;

  if not found then
    return json_build_object('eligible', false, 'reason', 'Advertisement not found');
  end if;

  if v_ad.user_id <> p_user_id then
    return json_build_object('eligible', false, 'reason', 'Advertisement does not belong to user');
  end if;

  if v_ad.deleted_at is not null then
    return json_build_object('eligible', false, 'reason', 'Advertisement is deleted');
  end if;

  if v_ad.status not in ('pending', 'approved') then
    return json_build_object('eligible', false, 'reason', 'Advertisement must be pending or approved');
  end if;

  if v_ad.expires_at is null then
    return json_build_object('eligible', false, 'reason', 'No expiry date set - cannot determine eligibility');
  end if;

  if v_ad.expires_at <= v_now then
    return json_build_object('eligible', false, 'reason', 'Advertisement is already expired');
  end if;

  v_remaining_seconds := extract(epoch from (v_ad.expires_at - v_now));
  v_remaining_days := floor(v_remaining_seconds / 86400);

  if v_remaining_days >= 3 then
    return json_build_object(
      'eligible', true,
      'reason', 'Boost eligible',
      'remaining_days', v_remaining_days,
      'expires_at', v_ad.expires_at
    );
  end if;

  return json_build_object(
    'eligible', false,
    'reason', 'Boost requires at least 3 full days remaining',
    'remaining_days', v_remaining_days,
    'expires_at', v_ad.expires_at
  );
end;
$$;

create or replace function public.check_extension_eligibility(p_ad_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad record;
  v_target_expiry timestamptz;
  v_now timestamptz := now();
begin
  select id, user_id, created_at, expires_at, status, deleted_at
    into v_ad
  from public.ads
  where id = p_ad_id;

  if not found then
    return json_build_object('eligible', false, 'reason', 'Advertisement not found');
  end if;

  if v_ad.user_id <> p_user_id then
    return json_build_object('eligible', false, 'reason', 'Advertisement does not belong to user');
  end if;

  if v_ad.deleted_at is not null then
    return json_build_object('eligible', false, 'reason', 'Advertisement is deleted');
  end if;

  if v_ad.status not in ('pending', 'approved') then
    return json_build_object('eligible', false, 'reason', 'Advertisement must be pending or approved');
  end if;

  if v_ad.expires_at is null then
    return json_build_object('eligible', false, 'reason', 'No expiry date set - cannot determine eligibility');
  end if;

  if v_ad.expires_at <= v_now then
    return json_build_object('eligible', false, 'reason', 'Advertisement already expired. Use renewal flow.');
  end if;

  v_target_expiry := v_ad.created_at + interval '10 days';

  if v_ad.expires_at >= v_target_expiry then
    return json_build_object(
      'eligible', false,
      'reason', 'Extension would not provide additional time',
      'current_expiry', v_ad.expires_at,
      'target_expiry', v_target_expiry,
      'created_at', v_ad.created_at
    );
  end if;

  return json_build_object(
    'eligible', true,
    'reason', 'Extension eligible',
    'current_expiry', v_ad.expires_at,
    'target_expiry', v_target_expiry,
    'created_at', v_ad.created_at
  );
end;
$$;

create or replace function public.create_boost_order(p_ad_id uuid, p_promotion_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo record;
  v_eligibility json;
  v_order_id uuid;
begin
  if p_promotion_slug is null or p_promotion_slug <> 'boost_3d' then
    raise exception 'Boost order requires the boost_3d promotion' using errcode = '45000';
  end if;

  select * into v_promo
  from public.promotions
  where slug = 'boost_3d'
    and is_active
    and type = 'boost'
    and plan_type = 'boost_3d';

  if not found then
    raise exception 'Boost promotion not found or inactive' using errcode = '45000';
  end if;

  v_eligibility := public.check_boost_eligibility(p_ad_id, auth.uid());
  if not (v_eligibility->>'eligible')::boolean then
    raise exception 'Boost not eligible: %', v_eligibility->>'reason'
      using errcode = '45000', hint = v_eligibility->>'reason';
  end if;

  insert into public.orders (user_id, ad_id, promotion_id, amount, currency, status, provider, provider_order_id)
  values (auth.uid(), p_ad_id, v_promo.id, v_promo.price, v_promo.currency, 'created', 'razorpay', 'ORDER_' || gen_random_uuid()::text)
  returning id into v_order_id;

  return json_build_object(
    'order_id', v_order_id,
    'amount', v_promo.price,
    'currency', v_promo.currency,
    'duration_days', v_promo.duration_days,
    'plan_type', v_promo.plan_type,
    'key_id', current_setting('razorpay.key_id', true)
  );
end;
$$;

create or replace function public.create_extension_order(p_ad_id uuid, p_promotion_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo record;
  v_eligibility json;
  v_order_id uuid;
begin
  if p_promotion_slug is null or p_promotion_slug <> 'extend_10d' then
    raise exception 'Extension order requires the extend_10d promotion' using errcode = '45000';
  end if;

  select * into v_promo
  from public.promotions
  where slug = 'extend_10d'
    and is_active
    and type = 'extension'
    and plan_type = 'extend_10d';

  if not found then
    raise exception 'Extension promotion not found or inactive' using errcode = '45000';
  end if;

  v_eligibility := public.check_extension_eligibility(p_ad_id, auth.uid());
  if not (v_eligibility->>'eligible')::boolean then
    raise exception 'Extension not eligible: %', v_eligibility->>'reason'
      using errcode = '45000', hint = v_eligibility->>'reason';
  end if;

  insert into public.orders (user_id, ad_id, promotion_id, amount, currency, status, provider, provider_order_id)
  values (auth.uid(), p_ad_id, v_promo.id, v_promo.price, v_promo.currency, 'created', 'razorpay', 'ORDER_' || gen_random_uuid()::text)
  returning id into v_order_id;

  return json_build_object(
    'order_id', v_order_id,
    'amount', v_promo.price,
    'currency', v_promo.currency,
    'duration_days', v_promo.duration_days,
    'plan_type', v_promo.plan_type,
    'key_id', current_setting('razorpay.key_id', true)
  );
end;
$$;

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

  if p_amount is not null and ord.amount is distinct from p_amount then
    return false;
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

  select * into promo
  from public.promotions
  where id = ord.promotion_id;

  if promo.id is null then
    return false;
  end if;

  if ord.amount is distinct from promo.price then
    raise exception 'Order amount mismatch for plan %', promo.slug using errcode = '45000';
  end if;

  if ord.currency is distinct from promo.currency then
    raise exception 'Order currency mismatch for plan %', promo.slug using errcode = '45000';
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

    if not (public.check_boost_eligibility(v_ad.id, ord.user_id)->>'eligible')::boolean then
      raise exception 'Boost not eligible for this advertisement' using errcode = '45000';
    end if;

    v_ends_at := now() + interval '3 days';

    insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
    values (ord.ad_id, ord.promotion_id, ord.id, now(), v_ends_at, 'active', promo.plan_type)
    on conflict (order_id) do update
      set status = 'active',
          starts_at = now(),
          ends_at = v_ends_at,
          plan_type = promo.plan_type;

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

    if v_ad.expires_at <= now() then
      raise exception 'Advertisement already expired. Use renewal flow.' using errcode = '45000';
    end if;

    v_target_expiry := v_ad.created_at + interval '10 days';

    if v_ad.expires_at >= v_target_expiry then
      -- Must not shorten a newer valid expiry. The extension order should not be applied.
      return false;
    end if;

    v_new_expires_at := greatest(v_ad.expires_at, v_target_expiry);
    v_ends_at := v_target_expiry;

    insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
    values (ord.ad_id, ord.promotion_id, ord.id, now(), v_ends_at, 'active', promo.plan_type)
    on conflict (order_id) do update
      set status = 'active',
          starts_at = now(),
          ends_at = v_ends_at,
          plan_type = promo.plan_type;

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
    insert into public.user_subscriptions (user_id, promotion_id, order_id, plan, ends_at, status)
    values (
      ord.user_id,
      ord.promotion_id,
      ord.id,
      case promo.slug when 'business-pro' then 'business-pro' else 'business' end,
      now() + (promo.duration_days || ' days')::interval,
      'active'
    );

    update public.profiles
       set plan = case promo.slug when 'business-pro' then 'business-pro' else 'business' end
     where id = ord.user_id;

    activated := true;

    perform public.notify_user(
      ord.user_id,
      'payment_success',
      'Subscription activated',
      promo.name,
      jsonb_build_object('order_id', ord.id)
    );
  end if;

  return activated or true;
end;
$$;

create or replace function public.expire_due_ads()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ads a
     set status = 'expired',
         updated_at = now()
   where a.status = 'approved'
     and a.deleted_at is null
     and a.expires_at is not null
     and a.expires_at <= now();
end;
$$;

create or replace function public.send_expiry_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad record;
  v_hours_remaining numeric;
  v_expiry_cycle timestamptz;
  v_message text;
begin
  for v_ad in
    select a.id, a.user_id, a.title, a.expires_at, a.listing_started_at
    from public.ads a
    where a.deleted_at is null
      and a.expires_at is not null
      and a.status in ('approved', 'expired')
      and a.expires_at > now()
      and a.expires_at <= now() + interval '24 hours'
  loop
    v_expiry_cycle := coalesce(v_ad.listing_started_at, v_ad.expires_at);
    v_hours_remaining := extract(epoch from (v_ad.expires_at - now())) / 3600;

    if v_hours_remaining <= 1 then
      v_message := 'Your advertisement "' || v_ad.title || '" expires in less than 1 hour. Renew now to keep it active.';
    elsif v_hours_remaining < 24 then
      v_message := 'Your advertisement "' || v_ad.title || '" expires in ' || floor(v_hours_remaining) || ' hour(s). Renew now to keep it active.';
    else
      v_message := 'Your advertisement "' || v_ad.title || '" expires tomorrow. Renew now to keep it active.';
    end if;

    insert into public.notifications (user_id, type, title, body, related_ad_id, expiry_cycle)
    values (
      v_ad.user_id,
      'expiring_soon',
      'Ad expiring soon: ' || v_ad.title,
      v_message,
      v_ad.id,
      v_expiry_cycle
    )
    on conflict (user_id, related_ad_id, type, expiry_cycle) do nothing;
  end loop;

  for v_ad in
    select a.id, a.user_id, a.title, a.expires_at, a.listing_started_at
    from public.ads a
    where a.deleted_at is null
      and a.expires_at is not null
      and a.status in ('approved', 'expired')
      and a.expires_at <= now()
  loop
    v_expiry_cycle := coalesce(v_ad.listing_started_at, v_ad.expires_at);

    insert into public.notifications (user_id, type, title, body, related_ad_id, expiry_cycle)
    values (
      v_ad.user_id,
      'expired',
      'Ad expired: ' || v_ad.title,
      'Your advertisement "' || v_ad.title || '" has expired. Renew it to make it active again.',
      v_ad.id,
      v_expiry_cycle
    )
    on conflict (user_id, related_ad_id, type, expiry_cycle) do nothing;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'expire-due-ads-every-15min') then
    perform cron.schedule(
      'expire-due-ads-every-15min',
      '*/15 * * * *',
      $$ select public.expire_due_ads();

$$ );

end if;

if not exists (select 1 from cron.job where jobname = 'expiry-notifications-hourly') then
    perform cron.schedule(
      'expiry-notifications-hourly',
      '0 * * * *',
      $$ select public.send_expiry_notifications();

$$ );

end if;

end $$;