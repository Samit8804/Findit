-- ============================================================
-- FindIt - Canonical paid-plan fulfillment, entitlement integrity,
-- historical reconciliation, and expiry repair.
-- Run AFTER 0052. Safe forward migration. Idempotent.
-- ============================================================

-- ---------- 1. Orders are server-written only ----------
-- 0019 accidentally allowed authenticated users to insert their own orders,
-- including orders with status = 'paid'. Never allow client-created orders.
drop policy if exists "orders_owner_write" on public.orders;
revoke insert, update, delete on public.orders from public;
revoke insert, update, delete on public.orders from anon;
revoke insert, update, delete on public.orders from authenticated;
grant all on public.orders to service_role;

-- ---------- 2. Canonical active plan configuration ----------
-- An active plan must have an explicit plan type and positive duration.
-- Deactivate invalid legacy rows instead of deleting purchase history.
update public.promotions
   set is_active = false,
       updated_at = now()
 where is_active
   and (
     plan_type is null
     or btrim(plan_type) = ''
     or duration_days is null
     or duration_days <= 0
   );

-- Collapse duplicate active products for the same plan type. Prefer the row
-- whose slug matches its plan_type, then the most recently configured row.
with ranked as (
  select id,
         row_number() over (
           partition by type, plan_type
           order by (slug = plan_type) desc, updated_at desc, created_at asc, id
         ) as rn
  from public.promotions
  where is_active
    and plan_type is not null
    and duration_days is not null
    and duration_days > 0
)
update public.promotions p
   set is_active = false,
       updated_at = now()
   from ranked r
 where p.id = r.id
   and r.rn > 1;

create unique index if not exists promotions_one_active_plan_type
  on public.promotions (type, plan_type)
  where is_active and plan_type is not null;

alter table public.promotions
  drop constraint if exists promotions_active_configuration_check;
alter table public.promotions
  add constraint promotions_active_configuration_check
  check (
    not is_active
    or (
      plan_type is not null
      and btrim(plan_type) <> ''
      and duration_days is not null
      and duration_days > 0
    )
  );

-- Messaging is an explicit per-plan feature. The old ₹149 price heuristic made
-- entitlement depend on price instead of the plan configuration.
alter table public.promotions
  drop constraint if exists promotions_messaging_price_check;

-- ---------- 3. Safe JSON / plan helpers ----------
create or replace function public.safe_text(p_value jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(p_value) = 'string' then p_value #>> '{}' else null end;
$$;

create or replace function public.safe_boolean(p_value jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(p_value) = 'boolean' then (p_value #>> '{}')::boolean else null end;
$$;

create or replace function public.safe_numeric(p_value jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(p_value) = 'number' then (p_value #>> '{}')::numeric else null end;
$$;

create or replace function public.safe_int(p_value jsonb)
returns int
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(p_value) = 'number' then trunc((p_value #>> '{}')::numeric)::int
    else null
  end;
$$;

create or replace function public.promotion_benefit_kind(p_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_type
    when 'extension' then 'listing_extension'
    when 'business_subscription' then 'subscription'
    when 'featured' then 'ad_placement'
    when 'top' then 'ad_placement'
    when 'boost' then 'ad_placement'
    else 'unsupported'
  end;
$$;

-- Only internal/server execution should be allowed to change protected
-- listing fields and profile plan labels.
create or replace function public.is_trusted_system_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or (
        auth.uid() is null
        and session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
      );
$$;

revoke all on function public.is_trusted_system_writer() from public;
revoke all on function public.is_trusted_system_writer() from anon;
revoke all on function public.is_trusted_system_writer() from authenticated;

-- 0008 already lets the service role bypass guard_ad_update. This repair is
-- required because 0028's expiry guard silently reverted system expiry writes.
create or replace function public.guard_ad_expiry_and_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_system_writer() then
    return new;
  end if;

  if not public.is_moderator() and new.expires_at is distinct from old.expires_at then
    if TG_OP = 'UPDATE' and old.status = 'draft' and new.status = 'pending' then
      if new.expires_at is distinct from (new.created_at + interval '7 days') then
        raise exception 'Invalid expires_at';
      end if;
    elsif TG_OP = 'UPDATE' and old.status = 'expired' and new.status = 'pending' then
      raise exception 'Renewal must go through paid promotion';
    else
      new.expires_at := old.expires_at;
    end if;
  end if;

  if not public.is_moderator() and new.status = 'approved' and old.status <> 'approved' then
    raise exception 'Only moderators can approve';
  end if;

  return new;
end;
$$;

-- Server-side plan completion also updates profiles.plan. The old profile
-- guard reverted those updates because auth.uid() is null for the service role.
create or replace function public.guard_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or public.is_trusted_system_writer() then
    return new;
  end if;
  if new.plan is distinct from old.plan then
    new.plan := old.plan;
  end if;
  if new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- ---------- 4. Effective ad-plan eligibility ----------
-- Duration is always taken from the purchased promotion snapshot/configuration.
create or replace function public.evaluate_ad_plan_eligibility(
  p_ad_id uuid,
  p_promotion_id uuid,
  p_user_id uuid,
  p_duration_days int default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ad record;
  v_promo record;
  v_kind text;
  v_duration int;
  v_start timestamptz;
  v_target timestamptz;
  v_remaining int;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'NOT_AUTHENTICATED',
      'message', 'Sign in to continue.'
    );
  end if;

  select * into v_promo from public.promotions where id = p_promotion_id;
  if not found then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'PROMOTION_NOT_FOUND',
      'message', 'This plan is unavailable.'
    );
  end if;
  if not v_promo.is_active then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'PROMOTION_INACTIVE',
      'message', 'This plan is no longer available.'
    );
  end if;
  if v_promo.plan_type is null or btrim(v_promo.plan_type) = '' then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'INVALID_PLAN_CONFIGURATION',
      'message', 'This plan is not configured correctly. Please contact support.'
    );
  end if;

  v_kind := public.promotion_benefit_kind(v_promo.type);
  v_duration := coalesce(p_duration_days, v_promo.duration_days);

  if v_kind = 'unsupported' then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'UNSUPPORTED_PLAN',
      'message', 'This plan type is not supported.'
    );
  end if;

  if v_duration is null or v_duration <= 0 then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'INVALID_PLAN_DURATION',
      'message', 'This plan does not have a valid duration.'
    );
  end if;

  if v_kind = 'subscription' then
    return jsonb_build_object(
      'eligible', true,
      'reason', 'ELIGIBLE',
      'message', 'Available.',
      'benefit_kind', v_kind,
      'plan_type', v_promo.plan_type,
      'duration_days', v_duration
    );
  end if;

  if p_ad_id is null then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'AD_REQUIRED',
      'message', 'Choose an advertisement first.'
    );
  end if;

  select * into v_ad from public.ads where id = p_ad_id;
  if v_ad.id is null then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'AD_NOT_FOUND',
      'message', 'Advertisement not found.'
    );
  end if;
  if v_ad.user_id <> p_user_id then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'AD_NOT_OWNED',
      'message', 'This advertisement does not belong to you.'
    );
  end if;
  if v_ad.deleted_at is not null then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'AD_DELETED',
      'message', 'This advertisement has been deleted.'
    );
  end if;
  if v_ad.status not in ('pending', 'approved') then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'AD_NOT_ACTIVE',
      'message', 'Only pending or approved advertisements can be promoted.'
    );
  end if;
  if v_ad.expires_at is null then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'AD_HAS_NO_EXPIRY',
      'message', 'This advertisement has no expiry date.'
    );
  end if;
  if v_ad.expires_at <= now() then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'AD_EXPIRED',
      'message', 'This advertisement has expired. Renew or repost it first.'
    );
  end if;

  if v_kind = 'ad_placement' then
    if v_promo.type = 'boost' then
      v_remaining := floor(extract(epoch from (v_ad.expires_at - now())) / 86400);
      if v_remaining < v_duration then
        return jsonb_build_object(
          'eligible', false,
          'reason', format('BOOST_NEEDS_%S_DAYS_REMAINING', v_duration),
          'message', format(
            'This advertisement needs at least %s full day(s) remaining for this boost.',
            v_duration
          ),
          'remaining_days', v_remaining,
          'duration_days', v_duration
        );
      end if;
    end if;

    return jsonb_build_object(
      'eligible', true,
      'reason', 'ELIGIBLE',
      'message', 'Available.',
      'benefit_kind', v_kind,
      'plan_type', v_promo.plan_type,
      'duration_days', v_duration,
      'current_expiry', v_ad.expires_at
    );
  end if;

  v_start := coalesce(v_ad.listing_started_at, v_ad.published_at, v_ad.created_at, now());
  v_target := v_start + make_interval(days => v_duration);

  if v_target <= v_ad.expires_at then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'EXTENSION_NO_ADDITIONAL_TIME',
      'message', 'This plan would not extend the listing.',
      'benefit_kind', v_kind,
      'duration_days', v_duration,
      'current_expiry', v_ad.expires_at,
      'target_expiry', v_target
    );
  end if;

  return jsonb_build_object(
    'eligible', true,
    'reason', 'ELIGIBLE',
    'message', 'Available.',
    'benefit_kind', v_kind,
    'plan_type', v_promo.plan_type,
    'duration_days', v_duration,
    'current_expiry', v_ad.expires_at,
    'target_expiry', v_target
  );
end;
$$;

create or replace function public.get_ad_plan_eligibility(
  p_ad_id uuid,
  p_promotion_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.evaluate_ad_plan_eligibility(p_ad_id, p_promotion_id, auth.uid(), null);
$$;

revoke all on function public.evaluate_ad_plan_eligibility(uuid, uuid, uuid, int) from public;
revoke all on function public.evaluate_ad_plan_eligibility(uuid, uuid, uuid, int) from anon;
revoke all on function public.evaluate_ad_plan_eligibility(uuid, uuid, uuid, int) from authenticated;
grant execute on function public.evaluate_ad_plan_eligibility(uuid, uuid, uuid, int) to service_role;

revoke all on function public.get_ad_plan_eligibility(uuid, uuid) from public;
revoke all on function public.get_ad_plan_eligibility(uuid, uuid) from anon;
grant execute on function public.get_ad_plan_eligibility(uuid, uuid) to authenticated;
grant execute on function public.get_ad_plan_eligibility(uuid, uuid) to service_role;

-- ---------- 5. Feature visibility refresh ----------
create or replace function public.refresh_ad_featured(p_ad_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ads a
     set is_featured = coalesce((
       select true
       from public.ad_promotions ap
       join public.promotions p on p.id = ap.promotion_id
       where ap.ad_id = a.id
         and ap.status = 'active'
         and p.type in ('featured', 'top')
         and (ap.starts_at is null or ap.starts_at <= now())
         and (ap.ends_at is null or ap.ends_at > now())
       limit 1
     ), false)
   where a.id = p_ad_id;
$$;

create or replace function public.refresh_featured_flags()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with desired as (
    select a.id,
           coalesce((
             select true
             from public.ad_promotions ap
             join public.promotions p on p.id = ap.promotion_id
             where ap.ad_id = a.id
               and ap.status = 'active'
               and p.type in ('featured', 'top')
               and (ap.starts_at is null or ap.starts_at <= now())
               and (ap.ends_at is null or ap.ends_at > now())
             limit 1
           ), false) as featured
    from public.ads a
  )
  update public.ads a
     set is_featured = d.featured
    from desired d
   where a.id = d.id
     and a.is_featured is distinct from d.featured;
end;
$$;

revoke all on function public.refresh_ad_featured(uuid) from public;
revoke all on function public.refresh_ad_featured(uuid) from anon;
revoke all on function public.refresh_ad_featured(uuid) from authenticated;
grant execute on function public.refresh_ad_featured(uuid) to service_role;

revoke all on function public.refresh_featured_flags() from public;
revoke all on function public.refresh_featured_flags() from anon;
revoke all on function public.refresh_featured_flags() from authenticated;
grant execute on function public.refresh_featured_flags() to service_role;

-- ---------- 6. One benefit application path ----------
create or replace function public.apply_paid_order_benefits(
  p_order_id uuid,
  p_effective_at timestamptz default null,
  p_emit_notifications boolean default true,
  p_historical boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
  promo public.promotions%rowtype;
  v_ad public.ads%rowtype;
  v_adp public.ad_promotions%rowtype;
  v_snapshot jsonb := '{}'::jsonb;
  v_type text;
  v_kind text;
  v_duration int;
  v_messaging boolean := false;
  v_plan_type text;
  v_plan text;
  v_effective timestamptz;
  v_start timestamptz;
  v_ends timestamptz;
  v_ad_target timestamptz;
  v_sub_target timestamptz;
  v_existing_ends timestamptz;
  v_ad_applied boolean := false;
  v_sub_applied boolean := false;
  v_skipped text[] := array[]::text[];
begin
  select * into ord from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'ORDER_NOT_FOUND');
  end if;
  if ord.status <> 'paid' then
    return jsonb_build_object('applied', false, 'reason', 'ORDER_NOT_PAID');
  end if;
  if ord.provider_payment_id is null then
    return jsonb_build_object('applied', false, 'reason', 'PAYMENT_NOT_VERIFIED');
  end if;
  if not exists (
    select 1
    from public.payment_transactions pt
    where pt.order_id = ord.id
      and pt.provider = ord.provider
      and pt.provider_transaction_id = ord.provider_payment_id
      and pt.status = 'success'
  ) then
    return jsonb_build_object('applied', false, 'reason', 'PAYMENT_NOT_VERIFIED');
  end if;

  select * into promo from public.promotions where id = ord.promotion_id;
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'PROMOTION_NOT_FOUND');
  end if;

  if jsonb_typeof(coalesce(ord.metadata, '{}'::jsonb) -> 'benefit_snapshot') = 'object' then
    v_snapshot := coalesce(ord.metadata, '{}'::jsonb) -> 'benefit_snapshot';
  end if;

  v_type := coalesce(public.safe_text(v_snapshot -> 'promotion_type'), promo.type);
  v_kind := public.promotion_benefit_kind(v_type);
  v_duration := coalesce(public.safe_int(v_snapshot -> 'duration_days'), promo.duration_days);
  v_messaging := coalesce(public.safe_boolean(v_snapshot -> 'messaging_access'), promo.messaging_access, false);
  v_plan_type := coalesce(public.safe_text(v_snapshot -> 'plan_type'), promo.plan_type);

  if v_kind = 'unsupported' then
    return jsonb_build_object('applied', false, 'reason', 'UNSUPPORTED_PLAN');
  end if;
  if v_duration is null or v_duration <= 0 then
    return jsonb_build_object('applied', false, 'reason', 'INVALID_PLAN_DURATION');
  end if;

  v_effective := coalesce(p_effective_at, ord.paid_at, now());

  if v_kind = 'ad_placement' then
    if ord.ad_id is null then
      v_skipped := array_append(v_skipped, 'AD_REQUIRED');
    else
      select * into v_ad from public.ads where id = ord.ad_id for update;
      select * into v_adp
      from public.ad_promotions
      where order_id = ord.id
        and status <> 'cancelled';

      if v_ad.id is null then
        v_skipped := array_append(v_skipped, 'AD_NOT_FOUND');
      elsif v_adp.id is not null then
        v_ad_applied := true;
        v_skipped := array_append(v_skipped, 'AD_BENEFIT_ALREADY_APPLIED');
      else
        v_ends := v_effective + make_interval(days => v_duration);

        if v_ends > now()
           and v_ad.deleted_at is null
           and v_ad.status in ('pending', 'approved')
           and (v_ad.expires_at is null or v_ad.expires_at > now()) then
          insert into public.ad_promotions
            (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
          values
            (ord.ad_id, ord.promotion_id, ord.id, v_effective, v_ends, 'active', v_plan_type)
          on conflict (order_id) do update
            set status = 'active',
                starts_at = excluded.starts_at,
                ends_at = excluded.ends_at,
                plan_type = excluded.plan_type
            where public.ad_promotions.status = 'cancelled';

          v_ad_applied := true;

          if v_type in ('featured', 'top') then
            perform public.refresh_ad_featured(v_ad.id);
          end if;

          if p_emit_notifications then
            perform public.notify_user(
              ord.user_id,
              case when v_type = 'boost' then 'boost_activated' else 'promotion_activated' end,
              case
                when v_type = 'boost' then 'Your Boost is now active'
                else coalesce(promo.name, 'Promotion') || ' is now active'
              end,
              coalesce(promo.name, 'Your promotion') || ' is active for ' || v_duration || ' days.',
              jsonb_build_object('ad_id', ord.ad_id, 'order_id', ord.id, 'ends_at', v_ends)
            );
          end if;
        else
          -- Record the historical entitlement without reviving an expired ad.
          insert into public.ad_promotions
            (ad_id, promotion_id, order_id, starts_at, ends_at, status, plan_type)
          values
            (ord.ad_id, ord.promotion_id, ord.id, v_effective, v_ends, 'expired', v_plan_type)
          on conflict (order_id) do nothing;

          v_ad_applied := true;
          v_skipped := array_append(v_skipped, 'AD_BENEFIT_WINDOW_EXPIRED_OR_AD_INACTIVE');
        end if;
      end if;
    end if;

  elsif v_kind = 'listing_extension' then
    if ord.ad_id is null then
      v_skipped := array_append(v_skipped, 'AD_REQUIRED');
    else
      select * into v_ad from public.ads where id = ord.ad_id for update;
      select * into v_adp
      from public.ad_promotions
      where order_id = ord.id
        and status <> 'cancelled';

      if v_ad.id is null then
        v_skipped := array_append(v_skipped, 'AD_NOT_FOUND');
      elsif v_adp.id is not null then
        v_ad_applied := true;
        v_skipped := array_append(v_skipped, 'EXTENSION_ALREADY_APPLIED');
      elsif v_ad.deleted_at is not null then
        v_skipped := array_append(v_skipped, 'AD_DELETED');
      elsif v_ad.status not in ('pending', 'approved') then
        v_skipped := array_append(v_skipped, 'AD_NOT_ACTIVE');
      elsif v_ad.expires_at is null then
        v_skipped := array_append(v_skipped, 'AD_HAS_NO_EXPIRY');
      elsif v_ad.expires_at <= now() then
        v_skipped := array_append(v_skipped, 'AD_EXPIRED_NO_REACTIVATION');
      else
        v_ad_target := coalesce(v_ad.listing_started_at, v_ad.published_at, v_ad.created_at, now())
                       + make_interval(days => v_duration);

        if v_ad_target <= v_ad.expires_at then
          v_skipped := array_append(v_skipped, 'EXTENSION_NO_ADDITIONAL_TIME');
        else
          insert into public.ad_promotions
            (ad_id, promotion_id, order_id, starts_at, ends_at, status,
             plan_type, original_expiry, extended_expiry)
          values
            (ord.ad_id, ord.promotion_id, ord.id, v_effective, v_ad_target, 'active',
             v_plan_type, v_ad.expires_at, v_ad_target)
          on conflict (order_id) do update
            set status = 'active',
                starts_at = excluded.starts_at,
                ends_at = excluded.ends_at,
                plan_type = excluded.plan_type,
                original_expiry = excluded.original_expiry,
                extended_expiry = excluded.extended_expiry
            where public.ad_promotions.status = 'cancelled';

          update public.ads
             set expires_at = v_ad_target,
                 updated_at = now()
           where id = ord.ad_id;

          v_ad_applied := true;

          if p_emit_notifications then
            perform public.notify_user(
              ord.user_id,
              'extension_activated',
              'Your listing has been extended',
              'Your listing is now active until ' || v_ad_target::text || '.',
              jsonb_build_object('ad_id', ord.ad_id, 'order_id', ord.id, 'expires_at', v_ad_target)
            );
          end if;
        end if;
      end if;
    end if;
  end if;

  if v_type = 'business_subscription' or v_messaging then

    v_sub_target := v_effective + make_interval(days => v_duration);

    select max(us.ends_at)
      into v_existing_ends
    from public.user_subscriptions us
    where us.user_id = ord.user_id
      and us.promotion_id = ord.promotion_id
      and us.status = 'active'
      and (
        us.order_id is null
        or exists (
          select 1 from public.orders o2
          where o2.id = us.order_id and o2.status = 'paid'
        )
      );

    if exists (
      select 1
      from public.user_subscriptions us
      where us.order_id = ord.id
        and us.status <> 'cancelled'
    ) then
      v_sub_applied := true;
      v_skipped := array_append(v_skipped, 'SUBSCRIPTION_ALREADY_APPLIED');
    elsif p_historical and v_existing_ends is not null and v_existing_ends >= v_sub_target then
      v_skipped := array_append(v_skipped, 'SUBSCRIPTION_ALREADY_COVERED');
    else
      if p_historical then
        v_start := v_effective;
        v_ends := v_sub_target;
      else
        v_start := greatest(coalesce(v_existing_ends, now()), now());
        v_ends := v_start + make_interval(days => v_duration);
      end if;

      v_plan := case
        when v_type = 'business_subscription' then
          case when v_plan_type = 'business_pro' then 'business-pro' else 'business' end
        else coalesce(v_plan_type, promo.plan_type, promo.slug, 'plan')
      end;

      insert into public.user_subscriptions
        (user_id, promotion_id, order_id, plan, starts_at, ends_at, status)
      values
        (ord.user_id, ord.promotion_id, ord.id, v_plan, v_start, v_ends,
         case when v_ends > now() then 'active' else 'expired' end);

      v_sub_applied := true;

      if v_type = 'business_subscription' then
        update public.profiles
           set plan = public.derive_profile_plan(ord.user_id)
         where id = ord.user_id;
      end if;

      if p_emit_notifications and v_ends > now() then
        perform public.notify_user(
          ord.user_id,
          'payment_success',
          case when v_type = 'business_subscription' then 'Subscription activated' else 'Messaging access activated' end,
          coalesce(promo.name, 'Plan') || ' is active until ' || v_ends::text || '.',
          jsonb_build_object('order_id', ord.id, 'expires_at', v_ends)
        );
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'applied', v_ad_applied or v_sub_applied,
    'benefit_kind', v_kind,
    'ad_applied', v_ad_applied,
    'subscription_applied', v_sub_applied,
    'skipped', to_jsonb(v_skipped)
  );
end;
$$;

revoke all on function public.apply_paid_order_benefits(uuid, timestamptz, boolean, boolean) from public;
revoke all on function public.apply_paid_order_benefits(uuid, timestamptz, boolean, boolean) from anon;
revoke all on function public.apply_paid_order_benefits(uuid, timestamptz, boolean, boolean) from authenticated;
grant execute on function public.apply_paid_order_benefits(uuid, timestamptz, boolean, boolean) to service_role;

-- ---------- 7. Verified payment completion ----------
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
  ord public.orders%rowtype;
  promo public.promotions%rowtype;
  v_snapshot jsonb := '{}'::jsonb;
  v_type text;
  v_kind text;
  v_duration int;
  v_expected_amount numeric;
  v_expected_currency text;
  v_payment_id text;
  v_result jsonb;
begin
  select * into ord from public.orders where id = p_order_id for update;
  if not found then
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

  v_payment_id := coalesce(nullif(p_provider_payment_id, ''), ord.provider_payment_id);
  if v_payment_id is null then
    return false;
  end if;
  if ord.provider_payment_id is not null
     and p_provider_payment_id is not null
     and ord.provider_payment_id <> p_provider_payment_id then
    return false;
  end if;

  select * into promo from public.promotions where id = ord.promotion_id;
  if not found then
    return false;
  end if;

  if jsonb_typeof(coalesce(ord.metadata, '{}'::jsonb) -> 'benefit_snapshot') = 'object' then
    v_snapshot := coalesce(ord.metadata, '{}'::jsonb) -> 'benefit_snapshot';
  end if;

  v_type := coalesce(public.safe_text(v_snapshot -> 'promotion_type'), promo.type);
  v_kind := public.promotion_benefit_kind(v_type);
  v_duration := coalesce(public.safe_int(v_snapshot -> 'duration_days'), promo.duration_days);
  v_expected_amount := coalesce(public.safe_numeric(v_snapshot -> 'price'), promo.price);
  v_expected_currency := coalesce(public.safe_text(v_snapshot -> 'currency'), promo.currency);

  if v_kind = 'unsupported'
     or v_duration is null
     or v_duration <= 0
     or v_expected_amount is null
     or v_expected_currency is null then
    return false;
  end if;

  if ord.amount is distinct from v_expected_amount
     or ord.currency is distinct from v_expected_currency then
    return false;
  end if;

  -- Serialize by gateway payment id so two orders can never consume one
  -- payment, even when verify and webhook arrive concurrently.
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || v_payment_id, 0));

  if exists (
    select 1
    from public.orders o2
    where o2.id <> ord.id
      and o2.provider = p_provider
      and o2.provider_payment_id = v_payment_id
  ) or exists (
    select 1
    from public.payment_transactions pt
    where pt.provider = p_provider
      and pt.provider_transaction_id = v_payment_id
      and pt.order_id <> ord.id
  ) then
    return false;
  end if;

  update public.orders
     set status = 'paid',
         paid_at = now(),
         provider_payment_id = v_payment_id,
         updated_at = now()
   where id = ord.id
     and status in ('created', 'pending')
     and (p_amount is null or amount = p_amount)
   returning * into ord;

  if ord.id is null then
    return false;
  end if;

  insert into public.payment_transactions
    (order_id, provider, provider_transaction_id, amount, currency, status)
  values
    (ord.id, p_provider, v_payment_id, ord.amount, ord.currency, 'success')
  on conflict (provider, provider_transaction_id) do update
    set status = 'success',
        amount = excluded.amount,
        currency = excluded.currency
    where public.payment_transactions.order_id = excluded.order_id;

  if not exists (
    select 1
    from public.payment_transactions pt
    where pt.order_id = ord.id
      and pt.provider = p_provider
      and pt.provider_transaction_id = v_payment_id
      and pt.status = 'success'
  ) then
    raise exception 'Payment transaction is linked to another order'
      using errcode = '23505';
  end if;

  -- The gateway payment is already captured at this point. A benefit-side
  -- exception must not roll back the paid order; record it for repair instead.
  begin
    v_result := public.apply_paid_order_benefits(ord.id, coalesce(ord.paid_at, now()), true, false);
  exception when others then
    v_result := jsonb_build_object(
      'applied', false,
      'reason', 'BENEFIT_APPLY_ERROR',
      'message', 'Benefit activation failed.',
      'code', sqlstate
    );
  end;

  update public.orders
     set metadata = (coalesce(metadata, '{}'::jsonb) - 'benefit_failure')
                    || jsonb_build_object('benefit_result', v_result)
                    || case
                         when coalesce((v_result ->> 'applied')::boolean, false) then '{}'::jsonb
                         else jsonb_build_object(
                           'benefit_failure',
                           jsonb_build_object(
                             'reason', 'BENEFIT_NOT_APPLIED',
                             'message', 'The payment was verified, but the plan could not be activated automatically. Please contact support with your order ID.',
                             'result', v_result
                           )
                         )
                       end,
         updated_at = now()
   where id = ord.id;

  return true;
end;
$$;

revoke all on function public.complete_paid_order(uuid, text, text, numeric) from public;
revoke all on function public.complete_paid_order(uuid, text, text, numeric) from anon;
revoke all on function public.complete_paid_order(uuid, text, text, numeric) from authenticated;
grant execute on function public.complete_paid_order(uuid, text, text, numeric) to service_role;

-- ---------- 8. Refund/reversal ----------
create or replace function public.revoke_paid_order_benefits(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
  v_extension record;
begin
  select * into ord from public.orders where id = p_order_id for update;
  if not found then
    return;
  end if;

  update public.user_subscriptions
     set status = 'cancelled',
         ends_at = least(coalesce(ends_at, now()), now())
   where order_id = ord.id
     and status = 'active';

  for v_extension in
    select ap.id, ap.ad_id, ap.original_expiry, ap.extended_expiry
    from public.ad_promotions ap
    join public.promotions p on p.id = ap.promotion_id
    where ap.order_id = ord.id
      and p.type = 'extension'
      and ap.status = 'active'
  loop
    update public.ad_promotions
       set status = 'cancelled'
     where id = v_extension.id;

    update public.ads
       set expires_at = v_extension.original_expiry,
           updated_at = now()
     where id = v_extension.ad_id
       and v_extension.original_expiry is not null
       and v_extension.extended_expiry is not null
       and expires_at = v_extension.extended_expiry;
  end loop;

  update public.ad_promotions
     set status = 'cancelled'
   where order_id = ord.id
     and status in ('active', 'pending');

  perform public.refresh_featured_flags();

  update public.profiles
     set plan = public.derive_profile_plan(ord.user_id)
   where id = ord.user_id;
end;
$$;

revoke all on function public.revoke_paid_order_benefits(uuid) from public;
revoke all on function public.revoke_paid_order_benefits(uuid) from anon;
revoke all on function public.revoke_paid_order_benefits(uuid) from authenticated;
grant execute on function public.revoke_paid_order_benefits(uuid) to service_role;

-- Keep the old name working for existing webhook deployments.
create or replace function public.revoke_subscription_for_order(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select public.revoke_paid_order_benefits(p_order_id);
$$;

revoke all on function public.revoke_subscription_for_order(uuid) from public;
revoke all on function public.revoke_subscription_for_order(uuid) from anon;
revoke all on function public.revoke_subscription_for_order(uuid) from authenticated;
grant execute on function public.revoke_subscription_for_order(uuid) to service_role;

-- Keep the displayed profile plan aligned with verified, active subscription
-- rows. This is display-only; messaging access is decided separately.
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
      left join public.orders o on o.id = us.order_id
      where us.user_id = p_user_id
        and us.status = 'active'
        and us.starts_at <= now()
        and (us.ends_at is null or us.ends_at > now())
        and p.type = 'business_subscription'
        and p.plan_type = 'business_pro'
        and (us.order_id is null or (o.id is not null and o.status = 'paid'))
    ) then 'business-pro'
    when exists (
      select 1
      from public.user_subscriptions us
      where us.user_id = p_user_id
        and us.promotion_id is null
        and us.status = 'active'
        and us.starts_at <= now()
        and (us.ends_at is null or us.ends_at > now())
        and us.plan = 'business-pro'
    ) then 'business-pro'
    when exists (
      select 1
      from public.user_subscriptions us
      join public.promotions p on p.id = us.promotion_id
      left join public.orders o on o.id = us.order_id
      where us.user_id = p_user_id
        and us.status = 'active'
        and us.starts_at <= now()
        and (us.ends_at is null or us.ends_at > now())
        and p.type = 'business_subscription'
        and (us.order_id is null or (o.id is not null and o.status = 'paid'))
    ) then 'business'
    when exists (
      select 1
      from public.user_subscriptions us
      where us.user_id = p_user_id
        and us.promotion_id is null
        and us.status = 'active'
        and us.starts_at <= now()
        and (us.ends_at is null or us.ends_at > now())
        and us.plan in ('business', 'business-pro')
    ) then 'business'
    else 'free'
  end;
$$;

-- ---------- 9. Messaging entitlement uses verified subscriptions only ----------
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
    left join public.orders o on o.id = us.order_id
    where us.user_id = p_user_id
      and us.status = 'active'
      and us.starts_at <= now()
      and (us.ends_at is null or us.ends_at > now())
      and coalesce(
        public.safe_boolean(coalesce(o.metadata, '{}'::jsonb) -> 'benefit_snapshot' -> 'messaging_access'),
        p.messaging_access,
        false
      )
      and (
        us.order_id is null
        or (o.id is not null and o.user_id = us.user_id and o.status = 'paid')
      )
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.user_subscriptions us
    left join public.orders o on o.id = us.order_id
    where us.user_id = p_user_id
      and us.promotion_id is null
      and us.status = 'active'
      and us.starts_at <= now()
      and (us.ends_at is null or us.ends_at > now())
      and us.plan in ('business', 'business-pro')
      and (
        us.order_id is null
        or (o.id is not null and o.user_id = us.user_id and o.status = 'paid')
      )
  );
end;
$$;

revoke all on function public.has_active_messaging_subscription(uuid) from public;
revoke all on function public.has_active_messaging_subscription(uuid) from anon;
revoke all on function public.has_active_messaging_subscription(uuid) from authenticated;
grant execute on function public.has_active_messaging_subscription(uuid) to service_role;

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
  left join public.orders o on o.id = us.order_id
  where us.user_id = v_uid
    and us.status = 'active'
    and us.starts_at <= now()
    and (us.ends_at is null or us.ends_at > now())
    and coalesce(
      public.safe_boolean(coalesce(o.metadata, '{}'::jsonb) -> 'benefit_snapshot' -> 'messaging_access'),
      p.messaging_access,
      false
    )
    and (
      us.order_id is null
      or (o.id is not null and o.user_id = us.user_id and o.status = 'paid')
    )
  order by us.ends_at desc nulls last
  limit 1;

  if v_plan_name is null then
    select us.plan, us.ends_at
      into v_legacy_plan, v_expires_at
    from public.user_subscriptions us
    left join public.orders o on o.id = us.order_id
    where us.user_id = v_uid
      and us.promotion_id is null
      and us.status = 'active'
      and us.starts_at <= now()
      and (us.ends_at is null or us.ends_at > now())
      and us.plan in ('business', 'business-pro')
      and (
        us.order_id is null
        or (o.id is not null and o.user_id = us.user_id and o.status = 'paid')
      )
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

revoke all on function public.get_my_messaging_access() from public;
revoke all on function public.get_my_messaging_access() from anon;
grant execute on function public.get_my_messaging_access() to authenticated;

-- ---------- 10. Expiry jobs keep promotions, flags, and listings in sync ----------
create or replace function public.expire_ad_promotions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ad_promotions
     set status = 'expired'
   where status = 'active'
     and ends_at is not null
     and ends_at <= now();

  perform public.refresh_featured_flags();
  perform public.expire_user_subscriptions();
end;
$$;

create or replace function public.expire_promotions()
returns void
language sql
security definer
set search_path = public
as $$
  select public.expire_ad_promotions();
$$;

create or replace function public.expire_due_ads()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_ad_promotions();

  update public.ads
     set status = 'expired',
         updated_at = now()
   where status = 'approved'
     and deleted_at is null
     and expires_at is not null
     and expires_at <= now();
end;
$$;

revoke all on function public.expire_ad_promotions() from public;
revoke all on function public.expire_ad_promotions() from anon;
revoke all on function public.expire_ad_promotions() from authenticated;
grant execute on function public.expire_ad_promotions() to service_role;

revoke all on function public.expire_promotions() from public;
revoke all on function public.expire_promotions() from anon;
revoke all on function public.expire_promotions() from authenticated;
grant execute on function public.expire_promotions() to service_role;

revoke all on function public.expire_due_ads() from public;
revoke all on function public.expire_due_ads() from anon;
revoke all on function public.expire_due_ads() from authenticated;
grant execute on function public.expire_due_ads() to service_role;

-- Legacy client-callable checkout RPCs are superseded by the signed
-- server-side create-order flow.
revoke all on function public.create_boost_order(uuid, text) from public;
revoke all on function public.create_boost_order(uuid, text) from anon;
revoke all on function public.create_boost_order(uuid, text) from authenticated;
revoke all on function public.create_extension_order(uuid, text) from public;
revoke all on function public.create_extension_order(uuid, text) from anon;
revoke all on function public.create_extension_order(uuid, text) from authenticated;

-- Remove the old price-based activation path and price floor helper. Runtime
-- entitlement now reads the explicit messaging_access flag / purchase snapshot.
drop function if exists public.apply_paid_subscription(uuid, uuid, uuid);
drop function if exists public.messaging_min_price();

-- ---------- 11. Historical dry-run and repair ----------
create or replace function public.audit_paid_order_entitlements(p_limit int default 1000)
returns table (
  order_id uuid,
  user_id uuid,
  ad_id uuid,
  promotion_name text,
  benefit_kind text,
  paid_at timestamptz,
  has_ad_benefit boolean,
  has_subscription boolean,
  needs_ad_benefit boolean,
  needs_subscription boolean,
  can_repair_ad boolean,
  can_repair_subscription boolean,
  expected_ad_ends_at timestamptz,
  expected_subscription_ends_at timestamptz,
  issue text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  v_ad record;
  v_snapshot jsonb;
  v_type text;
  v_kind text;
  v_duration int;
  v_messaging boolean;
  v_effective timestamptz;
  v_ad_target timestamptz;
  v_sub_target timestamptz;
  v_has_ad boolean;
  v_has_sub boolean;
  v_need_ad boolean;
  v_need_sub boolean;
  v_can_ad boolean;
  v_can_sub boolean;
  v_issue text;
  v_count int := 0;
begin
  for r in
    select o.*,
           p.name as promo_name,
           p.type as promo_type,
           p.plan_type as promo_plan_type,
           p.duration_days as promo_duration,
           p.messaging_access as promo_messaging
    from public.orders o
    join public.promotions p on p.id = o.promotion_id
    where o.status = 'paid'
      and o.provider_payment_id is not null
      and exists (
        select 1
        from public.payment_transactions pt
        where pt.order_id = o.id
          and pt.provider = o.provider
          and pt.provider_transaction_id = o.provider_payment_id
          and pt.status = 'success'
      )
    order by coalesce(o.paid_at, o.updated_at) asc, o.id
  loop
    exit when v_count >= greatest(coalesce(p_limit, 1000), 0);
    v_count := v_count + 1;

    v_snapshot := '{}'::jsonb;
    if jsonb_typeof(coalesce(r.metadata, '{}'::jsonb) -> 'benefit_snapshot') = 'object' then
      v_snapshot := coalesce(r.metadata, '{}'::jsonb) -> 'benefit_snapshot';
    end if;

    v_type := coalesce(public.safe_text(v_snapshot -> 'promotion_type'), r.promo_type);
    v_kind := public.promotion_benefit_kind(v_type);
    v_duration := coalesce(public.safe_int(v_snapshot -> 'duration_days'), r.promo_duration);
    v_messaging := coalesce(public.safe_boolean(v_snapshot -> 'messaging_access'), r.promo_messaging, false);
    v_effective := coalesce(r.paid_at, r.updated_at, now());

    v_has_ad := false;
    v_has_sub := false;
    v_need_ad := false;
    v_need_sub := false;
    v_can_ad := false;
    v_can_sub := false;
    v_ad_target := null;
    v_sub_target := null;
    v_issue := 'OK';
    v_ad := null;

    if v_kind = 'unsupported' then
      v_issue := 'UNSUPPORTED_PLAN';
    elsif v_duration is null or v_duration <= 0 then
      v_issue := 'INVALID_PLAN_DURATION';
    else
      if v_kind in ('ad_placement', 'listing_extension') then
        v_need_ad := true;
        v_has_ad := r.ad_id is not null
                    and exists (
                      select 1
                      from public.ad_promotions ap
                      where ap.order_id = r.id
                        and ap.status <> 'cancelled'
                    );

        if r.ad_id is not null then
          select * into v_ad from public.ads where id = r.ad_id;
        end if;

        if v_kind = 'ad_placement' then
          v_ad_target := v_effective + make_interval(days => v_duration);

          if v_has_ad then
            v_issue := 'AD_BENEFIT_PRESENT';
          elsif v_ad.id is null then
            v_issue := 'AD_NOT_FOUND';
          elsif v_ad.deleted_at is not null then
            v_issue := 'AD_DELETED';
          elsif v_ad.status not in ('pending', 'approved') then
            v_issue := 'AD_NOT_ACTIVE';
          elsif v_ad.expires_at is null or v_ad.expires_at <= now() then
            v_issue := 'AD_EXPIRED_NO_REACTIVATION';
          elsif v_ad_target <= now() then
            v_issue := 'AD_BENEFIT_WINDOW_PAST';
          else
            v_can_ad := true;
            v_issue := 'MISSING_AD_BENEFIT';
          end if;
        else
          if v_ad.id is null then
            v_issue := 'AD_NOT_FOUND';
          elsif v_ad.deleted_at is not null then
            v_issue := 'AD_DELETED';
          elsif v_ad.status not in ('pending', 'approved') then
            v_issue := 'AD_NOT_ACTIVE';
          elsif v_ad.expires_at is null then
            v_issue := 'AD_HAS_NO_EXPIRY';
          elsif v_ad.expires_at <= now() then
            v_issue := 'AD_EXPIRED_NO_REACTIVATION';
          else
            v_ad_target := coalesce(v_ad.listing_started_at, v_ad.published_at, v_ad.created_at, now())
                           + make_interval(days => v_duration);

            if v_has_ad then
              v_issue := 'EXTENSION_PRESENT';
            elsif v_ad_target <= v_ad.expires_at then
              v_issue := 'EXTENSION_NO_ADDITIONAL_TIME';
            elsif v_ad_target <= now() then
              v_issue := 'EXTENSION_WINDOW_PAST';
            else
              v_can_ad := true;
              v_issue := 'MISSING_LISTING_EXTENSION';
            end if;
          end if;
        end if;
      end if;

      if v_type = 'business_subscription' or v_messaging then
        v_need_sub := true;
        v_sub_target := v_effective + make_interval(days => v_duration);

        v_has_sub := exists (
          select 1
          from public.user_subscriptions us
          where us.order_id = r.id
            and us.status <> 'cancelled'
        ) or exists (
          select 1
          from public.user_subscriptions us
          left join public.orders o on o.id = us.order_id
          where us.user_id = r.user_id
            and us.promotion_id = r.promotion_id
            and us.status = 'active'
            and us.starts_at <= now()
            and (us.ends_at is null or us.ends_at > now())
            and (us.ends_at is null or us.ends_at >= v_sub_target)
            and (
              us.order_id is null
              or (o.id is not null and o.user_id = us.user_id and o.status = 'paid')
            )
        );

        if not v_has_sub then
          if v_sub_target <= now() then
            v_issue := case when v_issue = 'OK' then 'SUBSCRIPTION_WINDOW_PAST' else v_issue || '+SUBSCRIPTION_WINDOW_PAST' end;
          else
            v_can_sub := true;
            v_issue := case when v_issue = 'OK' then 'MISSING_SUBSCRIPTION' else v_issue || '+MISSING_SUBSCRIPTION' end;
          end if;
        elsif v_issue = 'OK' then
          v_issue := 'SUBSCRIPTION_PRESENT';
        end if;
      end if;
    end if;

    return query
      select r.id,
             r.user_id,
             r.ad_id,
             r.promo_name,
             v_kind,
             v_effective,
             v_has_ad,
             v_has_sub,
             v_need_ad,
             v_need_sub,
             v_can_ad,
             v_can_sub,
             v_ad_target,
             v_sub_target,
             v_issue;
  end loop;
end;
$$;

revoke all on function public.audit_paid_order_entitlements(int) from public;
revoke all on function public.audit_paid_order_entitlements(int) from anon;
revoke all on function public.audit_paid_order_entitlements(int) from authenticated;
grant execute on function public.audit_paid_order_entitlements(int) to service_role;

create or replace function public.preview_paid_order_entitlements(p_limit int default 1000)
returns table (
  order_id uuid,
  promotion_name text,
  benefit_kind text,
  paid_at timestamptz,
  issue text,
  can_repair_ad boolean,
  can_repair_subscription boolean,
  expected_ad_ends_at timestamptz,
  expected_subscription_ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.order_id,
         a.promotion_name,
         a.benefit_kind,
         a.paid_at,
         a.issue,
         a.can_repair_ad,
         a.can_repair_subscription,
         a.expected_ad_ends_at,
         a.expected_subscription_ends_at
  from public.audit_paid_order_entitlements(p_limit) a
  where a.needs_ad_benefit or a.needs_subscription
  order by a.paid_at asc, a.order_id;
$$;

revoke all on function public.preview_paid_order_entitlements(int) from public;
revoke all on function public.preview_paid_order_entitlements(int) from anon;
revoke all on function public.preview_paid_order_entitlements(int) from authenticated;
grant execute on function public.preview_paid_order_entitlements(int) to service_role;

create or replace function public.reconcile_paid_order_entitlements(
  p_apply boolean default false,
  p_limit int default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total int;
  v_needs int;
  v_repairable int;
  v_applied int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_samples jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  select count(*),
         count(*) filter (where needs_ad_benefit or needs_subscription),
         count(*) filter (where can_repair_ad or can_repair_subscription)
    into v_total, v_needs, v_repairable
  from public.audit_paid_order_entitlements(p_limit);

  if not coalesce(p_apply, false) then
    v_skipped := greatest(v_needs - v_repairable, 0);

    select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      into v_samples
    from (
      select order_id,
             promotion_name,
             benefit_kind,
             paid_at,
             issue,
             can_repair_ad,
             can_repair_subscription,
             expected_ad_ends_at,
             expected_subscription_ends_at
      from public.audit_paid_order_entitlements(p_limit)
      where needs_ad_benefit or needs_subscription
      order by paid_at asc, order_id
      limit 100
    ) s;
  else
    for r in
      select *
      from public.audit_paid_order_entitlements(p_limit)
      where needs_ad_benefit or needs_subscription
      order by paid_at asc, order_id
    loop
      if r.can_repair_ad or r.can_repair_subscription then
        begin
          v_result := public.apply_paid_order_benefits(r.order_id, r.paid_at, false, true);
          if coalesce((v_result ->> 'applied')::boolean, false) then
            v_applied := v_applied + 1;
          else
            v_skipped := v_skipped + 1;
          end if;
        exception when others then
          v_errors := v_errors + 1;
        end;
      else
        v_skipped := v_skipped + 1;
      end if;

      if jsonb_array_length(v_samples) < 100 then
        v_samples := v_samples || jsonb_build_array(jsonb_build_object(
          'order_id', r.order_id,
          'promotion_name', r.promotion_name,
          'benefit_kind', r.benefit_kind,
          'issue', r.issue,
          'applied', r.can_repair_ad or r.can_repair_subscription
        ));
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'dry_run', not coalesce(p_apply, false),
    'total_paid_verified', v_total,
    'needs_repair', v_needs,
    'repairable', v_repairable,
    'applied', v_applied,
    'skipped', v_skipped,
    'errors', v_errors,
    'samples', v_samples
  );
end;
$$;

revoke all on function public.reconcile_paid_order_entitlements(boolean, int) from public;
revoke all on function public.reconcile_paid_order_entitlements(boolean, int) from anon;
revoke all on function public.reconcile_paid_order_entitlements(boolean, int) from authenticated;
grant execute on function public.reconcile_paid_order_entitlements(boolean, int) to service_role;

-- ---------- 12. Refresh plan labels once after migration ----------
do $$
declare
  v_user uuid;
begin
  for v_user in select distinct user_id from public.user_subscriptions loop
    update public.profiles
       set plan = public.derive_profile_plan(v_user)
     where id = v_user;
  end loop;
end
$$;
