-- ============================================================
-- FindIt — Fix payment completion for boost and extension plans
-- Safe forward migration: does not rewrite already-applied history.
-- ============================================================

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
  v_ends_at timestamptz;
  v_new_expires_at timestamptz;
  activated boolean := false;
begin
  -- Lock the order row once and ensure we do not apply the same payment twice.
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

  -- Boost: 3-day period only; never modify the original listing expiry.
  if promo.type = 'boost' and promo.plan_type = 'boost_3d' and ord.ad_id is not null then
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

  -- Extension: total lifetime of 10 days from original ad creation.
  elsif promo.type = 'extension' and promo.plan_type = 'extend_10d' and ord.ad_id is not null then
    select * into v_ad
    from public.ads
    where id = ord.ad_id
    for update;

    if v_ad.id is null then
      raise exception 'Advertisement not found' using errcode = '45000';
    end if;

    if v_ad.expires_at is not null and v_ad.expires_at <= now() then
      raise exception 'Advertisement already expired. Use renewal flow.' using errcode = '45000';
    end if;

    v_new_expires_at := greatest(v_ad.created_at + interval '10 days', coalesce(v_ad.expires_at, v_ad.created_at));
    v_ends_at := v_ad.created_at + interval '10 days';

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

  -- Preserve the original supported promotion types and behavior.
  elsif promo.type in ('featured','top') and ord.ad_id is not null then
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