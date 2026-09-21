-- ============================================================
-- FindIt — Fix Boost eligibility enforcement and protect completion
-- Safe forward migration: does not rewrite already-applied history.
-- ============================================================

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
  v_eligibility json;
  v_ends_at timestamptz;
  activated boolean := false;
begin
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

  if promo.type = 'boost' and promo.plan_type = 'boost_3d' and ord.ad_id is not null then
    select * into v_ad
    from public.ads
    where id = ord.ad_id
    for update;

    if v_ad.id is null then
      raise exception 'Advertisement not found' using errcode = '45000';
    end if;

    v_eligibility := public.check_boost_eligibility(v_ad.id, ord.user_id);
    if not (v_eligibility->>'eligible')::boolean then
      raise exception 'Boost not eligible: %', v_eligibility->>'reason'
        using errcode = '45000', hint = v_eligibility->>'reason';
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
  end if;

  return activated or true;
end;
$$;