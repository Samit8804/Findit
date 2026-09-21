-- ============================================================
-- FindIt — Fix extension eligibility and completion for 10-day listing extension
-- Safe forward migration: does not rewrite already-applied history.
-- ============================================================

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
  v_eligibility := public.check_extension_eligibility(p_ad_id, auth.uid());
  if not (v_eligibility->>'eligible')::boolean then
    raise exception 'Extension not eligible: %', v_eligibility->>'reason'
      using errcode = '45000', hint = v_eligibility->>'reason';
  end if;

  select * into v_promo
  from public.promotions
  where slug = p_promotion_slug and is_active;

  if not found then
    raise exception 'Promotion not found or inactive';
  end if;

  insert into public.orders (user_id, ad_id, promotion_id, amount, currency, status, provider, provider_order_id)
  values (auth.uid(), p_ad_id, v_promo.id, v_promo.price, v_promo.currency, 'created', 'razorpay', 'ORDER_' || gen_random_uuid()::text)
  returning id into v_order_id;

  return json_build_object(
    'order_id', v_order_id,
    'amount', v_promo.price,
    'currency', v_promo.currency,
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
  v_new_expiry timestamptz;
  v_eligibility json;
  activated boolean := false;
begin
  update public.orders
     set status = 'paid',
         paid_at = now(),
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         updated_at = now()
   where id = p_order_id
     and status in ('created','pending')
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

  if promo.type = 'extension' and promo.plan_type = 'extend_10d' and ord.ad_id is not null then
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
      raise exception 'Extension would not provide additional time' using errcode = '45000';
    end if;

    v_new_expiry := greatest(v_ad.expires_at, v_target_expiry);

    insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
    values (ord.ad_id, ord.promotion_id, ord.id, now(), v_target_expiry, 'active', promo.plan_type)
    on conflict (order_id) do update
      set status = 'active',
          starts_at = now(),
          ends_at = v_target_expiry,
          plan_type = promo.plan_type;

    update public.ads
       set expires_at = v_new_expiry,
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
  elsif promo.type in ('featured','top','boost') and ord.ad_id is not null then
    -- leave existing behavior unchanged for other supported promotion types
    insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
    values (ord.ad_id, ord.promotion_id, ord.id, now(), now() + (promo.duration_days || ' days')::interval, 'active', promo.plan_type)
    on conflict (order_id) do update
      set status = 'active',
          starts_at = now(),
          ends_at = now() + (promo.duration_days || ' days')::interval,
          plan_type = promo.plan_type;

    activated := true;
  end if;

  return activated or true;
end;
$$;