-- ============================================================
-- FindIt — Fix Listing Timing: Use listing_started_at instead of created_at
-- Run AFTER 0021. Idempotent.
-- ============================================================

-- 1. Add listing_started_at column to ads table
alter table public.ads add column if not exists listing_started_at timestamptz;

-- 2. Backfill listing_started_at for existing approved ads
-- For approved ads with published_at, use published_at; otherwise use created_at as fallback
update public.ads
set listing_started_at = coalesce(published_at, created_at)
where status = 'approved' and listing_started_at is null;

-- 3. Update expire_due_ads to use listing_started_at for expiry check
create or replace function public.expire_due_ads()
returns void language sql security definer set search_path = public as $$
  update public.ads
     set status = 'expired'
   where status = 'approved'
     and expires_at is not null
     and expires_at < now();
$$;

-- 4. Update the trigger to set listing_started_at when ad first becomes approved
create or replace function public.set_listing_started_at_on_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- When status changes to approved for the first time, set listing_started_at
  if old.status <> 'approved' and new.status = 'approved' and new.listing_started_at is null then
    new.listing_started_at := now();
    -- Also set published_at if not set
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_listing_started_at on public.ads;
create trigger trg_set_listing_started_at
before update of status on public.ads
for each row execute function public.set_listing_started_at_on_approval();

-- 5. Update enforce_free_plan_on_insert to set expires_at based on listing_started_at
-- Note: For new ads submitted directly (pending -> approved), listing_started_at will be set by trigger above
create or replace function public.enforce_free_plan_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if new.status in ('pending','approved') then
    select public.free_ads_this_month(new.user_id) into v_count;
    if v_count >= 3 then
      raise exception 'FREE_LIMIT_REACHED' using errcode = '45000', hint = 'You have reached your free limit of 3 ads for this month.';
    end if;
    -- For new ads, expires_at will be set when they become approved (via trigger)
    -- If directly inserted as approved (admin), set it now
    if new.status = 'approved' and new.expires_at is null then
      new.expires_at := coalesce(new.listing_started_at, now()) + interval '7 days';
    end if;
    if new.status = 'approved' and new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- 6. Update enforce_free_plan_on_update to set expires_at when transitioning to approved
create or replace function public.enforce_free_plan_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if old.status = 'draft' and new.status in ('pending','approved') then
    select public.free_ads_this_month(new.user_id) into v_count;
    if v_count > 3 then
      raise exception 'FREE_LIMIT_REACHED' using errcode = '45000';
    end if;
    if new.status = 'approved' and new.expires_at is null then
      new.expires_at := coalesce(new.listing_started_at, now()) + interval '7 days';
    end if;
    if new.status = 'approved' and new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- 7. Update complete_paid_order to use listing_started_at for extension calculation
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

  if promo.type in ('featured','top','boost','extension') and ord.ad_id is not null then
    declare
      v_ends_at timestamptz;
      v_ad record;
    begin
      select * into v_ad from public.ads where id = ord.ad_id;

      if promo.plan_type = 'extend_10d' then
        -- Extension: 10 days from listing_started_at (when ad became publicly active)
        select listing_started_at + interval '10 days' into v_ends_at from public.ads where id = ord.ad_id;
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

    -- For extension type, also extend the ad's expires_at using listing_started_at
    if promo.plan_type = 'extend_10d' then
      update public.ads
      set expires_at = greatest(
        (select listing_started_at from public.ads where id = ord.ad_id) + interval '10 days',
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
        v_notif_body := 'Your advertisement "' || v_ad_title || '" is now active for 10 days from when it went live.';
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

-- 8. Update create_extension_order RPC to check eligibility using listing_started_at
create or replace function public.create_extension_order(p_ad_id uuid, p_promotion_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_promo record;
  v_ad record;
  v_now timestamptz := now();
  v_listing_started timestamptz;
  v_new_expiry timestamptz;
  v_order_id uuid;
begin
  select id, user_id, created_at, listing_started_at, expires_at, status, deleted_at
  into v_ad
  from public.ads
  where id = p_ad_id;

  if not found then
    raise exception 'Advertisement not found' using errcode = '45000';
  end if;

  if v_ad.user_id != auth.uid() then
    raise exception 'Advertisement does not belong to user' using errcode = '45000';
  end if;

  if v_ad.deleted_at is not null then
    raise exception 'Advertisement is deleted' using errcode = '45000';
  end if;

  if v_ad.status not in ('pending', 'approved') then
    raise exception 'Advertisement must be pending or approved' using errcode = '45000';
  end if;

  -- Use listing_started_at for extension calculation
  v_listing_started := coalesce(v_ad.listing_started_at, v_ad.created_at);
  v_new_expiry := v_listing_started + interval '10 days';

  -- If already expired, cannot extend with 10-day total
  if v_ad.expires_at is not null and v_ad.expires_at < now() then
    raise exception 'Advertisement already expired. Use renewal flow.' using errcode = '45000';
  end if;

  -- Check if extension provides additional time
  if v_new_expiry <= coalesce(v_ad.expires_at, now()) then
    raise exception 'Extension would not provide additional time' using errcode = '45000';
  end if;

  -- Get promotion
  select * into v_promo from public.promotions where slug = p_promotion_slug and is_active;
  if not found then
    raise exception 'Promotion not found or inactive';
  end if;

  -- Create order
  insert into public.orders (user_id, ad_id, promotion_id, amount, currency, status, provider, provider_order_id)
  values (auth.uid(), p_ad_id, v_promo.id, v_promo.price, v_promo.currency, 'created', 'razorpay', 'ORDER_' || gen_random_uuid()::text)
  returning id into v_order_id;

  return json_build_object('order_id', v_order_id, 'amount', v_promo.price, 'currency', v_promo.currency, 'key_id', current_setting('razorpay.key_id', true));
end;
$$;

-- 9. Update check_extension_eligibility to use listing_started_at
create or replace function public.check_extension_eligibility(p_ad_id uuid, p_user_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_ad record;
  v_listing_started timestamptz;
  v_new_expiry timestamptz;
begin
  select id, user_id, created_at, listing_started_at, expires_at, status, deleted_at
  into v_ad
  from public.ads
  where id = p_ad_id;

  if not found then
    return json_build_object('eligible', false, 'reason', 'Advertisement not found');
  end if;

  if v_ad.user_id != p_user_id then
    return json_build_object('eligible', false, 'reason', 'Advertisement does not belong to user');
  end if;

  if v_ad.deleted_at is not null then
    return json_build_object('eligible', false, 'reason', 'Advertisement is deleted');
  end if;

  if v_ad.status not in ('pending', 'approved') then
    return json_build_object('eligible', false, 'reason', 'Advertisement must be pending or approved');
  end if;

  v_listing_started := coalesce(v_ad.listing_started_at, v_ad.created_at);
  v_new_expiry := v_listing_started + interval '10 days';

  if v_ad.expires_at is not null and v_ad.expires_at < now() then
    return json_build_object('eligible', false, 'reason', 'Advertisement already expired. Use renewal flow.');
  end if;

  if v_new_expiry <= coalesce(v_ad.expires_at, now()) then
    return json_build_object('eligible', false, 'reason', 'Extension would not provide additional time');
  end if;

  return json_build_object('eligible', true, 'reason', 'Extension eligible', 'new_expiry', v_new_expiry);
end;
$$;

-- 10. Index for listing_started_at
create index if not exists idx_ads_listing_started on public.ads(listing_started_at) where deleted_at is null and status = 'approved';