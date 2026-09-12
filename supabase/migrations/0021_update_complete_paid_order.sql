-- ============================================================
-- FindIt — Update complete_paid_order for new plan types
-- Run AFTER 0019_paid_plans_boost_extension. Idempotent.
-- ============================================================

-- Extend complete_paid_order to handle new 'extension' promo type and plan_type values
-- This function is ONLY called by verified webhook/verify endpoint - it is the trusted payment completion path

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
  activated boolean := false;
begin
  -- Lock the order row; transition once
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
    return false; -- already processed or mismatched amount
  end if;

  -- Transaction record (unique constraint keeps webhooks idempotent)
  if p_provider_payment_id is not null then
    insert into public.payment_transactions (order_id, provider, provider_transaction_id, amount, currency, status)
    values (ord.id, p_provider, p_provider_payment_id, ord.amount, ord.currency, 'success')
    on conflict (provider, provider_transaction_id) do nothing;
  end if;

  -- Activate what was purchased
  select * into promo from public.promotions where id = ord.promotion_id;

  -- Handle all promotion types including new boost_3d and extend_10d
  if promo.type in ('featured','top','boost','extension') and ord.ad_id is not null then
    -- For extension type, calculate proper ends_at based on plan_type
    declare
      v_ends_at timestamptz;
    begin
      if promo.plan_type = 'extend_10d' then
        -- Extension: 10 days from original creation
        select (created_at + interval '10 days') into v_ends_at from public.ads where id = ord.ad_id;
      else
        -- Standard: duration_days from now
        v_ends_at := now() + (promo.duration_days || ' days')::interval;
      end if;

      insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
      values (ord.ad_id, ord.promotion_id, ord.id, now(), v_ends_at, 'active', promo.plan_type)
      on conflict (order_id) do update
        set status = 'active',
            starts_at = now(),
            ends_at = v_ends_at,
            plan_type = promo.plan_type;
    end;

    activated := true;

    if promo.type in ('featured','top') then
      update public.ads set is_featured = true where id = ord.ad_id;
    end if;

    -- For extension type, also extend the ad's expires_at
    if promo.plan_type = 'extend_10d' then
      update public.ads
      set expires_at = greatest(
        (select created_at from public.ads where id = ord.ad_id) + interval '10 days',
        coalesce(expires_at, now())
      )
      where id = ord.ad_id;
    end if;

    -- Notify user based on plan type
    declare
      v_ad_title text;
      v_notif_type text;
      v_notif_title text;
      v_notif_body text;
    begin
      select title into v_ad_title from public.ads where id = ord.ad_id;

      if promo.plan_type = 'boost_3d' then
        v_notif_type := 'boost_activated';
        v_notif_title := 'Your 3-day Boost is now active!';
        v_notif_body := 'Your advertisement "' || v_ad_title || '" is now boosted for 3 days.';
      elsif promo.plan_type = 'extend_10d' then
        v_notif_type := 'extension_activated';
        v_notif_title := 'Your listing has been extended to 10 days total.';
        v_notif_body := 'Your advertisement "' || v_ad_title || '" is now active for 10 days from original posting.';
      else
        v_notif_type := 'promotion_activated';
        v_notif_title := promo.name || ' promotion is now active.';
        v_notif_body := 'Your advertisement "' || v_ad_title || '" is now promoted.';
      end if;

      perform public.notify_user(
        ord.user_id,
        v_notif_type,
        v_notif_title,
        v_notif_body,
        jsonb_build_object('ad_id', ord.ad_id, 'order_id', ord.id)
      );
    end;

    perform public.notify_user(
      ord.user_id,
      'payment_success',
      'Payment successful',
      left(promo.name || ' — ₹' || ord.amount::text, 80),
      jsonb_build_object('order_id', ord.id)
    );

  elsif promo.type = 'business_subscription' then
    insert into public.user_subscriptions (user_id, promotion_id, order_id, plan, ends_at, status)
    values (ord.user_id,
            ord.promotion_id,
            ord.id,
            case promo.slug when 'business-pro' then 'business-pro' else 'business' end,
            now() + (promo.duration_days || ' days')::interval,
            'active');

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