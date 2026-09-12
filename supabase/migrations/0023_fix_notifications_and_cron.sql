-- ============================================================
-- FindIt — Fix Notification Lifecycle, Expiry Ordering, Permissions
-- Run AFTER 0022. Idempotent.
-- ============================================================

-- 1. Fix notification idempotency: add unique constraint on (user_id, related_ad_id, type, expiry_cycle)
-- We use a composite key that includes the expiry timestamp to allow new notifications after renewal

-- First, add a column to track the expiry cycle for deduplication
alter table public.notifications add column if not exists expiry_cycle timestamptz;

-- Create unique index for idempotency per expiry cycle
-- This allows: one notification per type per ad per expiry cycle
-- After renewal (new expiry_cycle), new notifications are allowed
create unique index if not exists uniq_notification_per_cycle
  on public.notifications (user_id, related_ad_id, type, expiry_cycle)
  where type in ('expiring_soon', 'expired');

-- 2. Fix expire_due_ads to also emit expired notifications atomically
-- This ensures no race condition between expiry and notification
create or replace function public.expire_due_ads()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ad record;
begin
  -- Find ads that need to expire
  for v_ad in
    select id, user_id, title, expires_at, listing_started_at
    from public.ads
    where status = 'approved'
      and expires_at is not null
      and expires_at < now()
      and deleted_at is null
  loop
    -- Update status to expired
    update public.ads
    set status = 'expired'
    where id = v_ad.id;

    -- Insert expired notification with expiry_cycle = listing_started_at (or expires_at for old ads)
    -- This uses the unique index to prevent duplicates
    insert into public.notifications (user_id, type, title, body, related_ad_id, expiry_cycle)
    values (v_ad.user_id, 'expired',
      'Ad expired: ' || v_ad.title,
      'Your advertisement "' || v_ad.title || '" has expired. Renew it to make it active again.',
      v_ad.id,
      coalesce(v_ad.listing_started_at, v_ad.expires_at)
    )
    on conflict (user_id, related_ad_id, type, expiry_cycle) do nothing;
  end loop;
end;
$$;

-- 3. Fix send_expiry_notifications for expiring_soon (24h window)
-- Also use expiry_cycle for deduplication
-- Only search approved ads (not yet expired)
create or replace function public.send_expiry_notifications()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ad record;
  v_hours_remaining numeric;
  v_expiry_cycle timestamptz;
begin
  -- Expiring soon (24 hours): expires_at between now() and now() + 24 hours
  for v_ad in
    select a.id, a.user_id, a.title, a.expires_at, a.listing_started_at
    from public.ads a
    where a.status = 'approved'
      and a.deleted_at is null
      and a.expires_at is not null
      and a.expires_at > now()
      and a.expires_at <= now() + interval '24 hours'
  loop
    v_hours_remaining := extract(epoch from (v_ad.expires_at - now())) / 3600;
    v_expiry_cycle := coalesce(v_ad.listing_started_at, v_ad.expires_at);

    -- Human-readable time
    declare
      v_message text;
    begin
      if v_hours_remaining <= 1 then
        v_message := 'Your advertisement "' || v_ad.title || '" expires in less than 1 hour. Renew now to keep it active.';
      elsif v_hours_remaining < 24 then
        v_message := 'Your advertisement "' || v_ad.title || '" expires in ' || floor(v_hours_remaining) || ' hour(s). Renew now to keep it active.';
      else
        v_message := 'Your advertisement "' || v_ad.title || '" expires tomorrow. Renew now to keep it active.';
      end if;

      insert into public.notifications (user_id, type, title, body, related_ad_id, expiry_cycle)
      values (v_ad.user_id, 'expiring_soon',
        'Ad expiring soon: ' || v_ad.title,
        v_message,
        v_ad.id,
        v_expiry_cycle
      )
      on conflict (user_id, related_ad_id, type, expiry_cycle) do nothing;
    end;
  end loop;

  -- For already-expired ads that somehow missed notification (e.g., expired before cron ran)
  -- Search both approved AND expired status
  for v_ad in
    select a.id, a.user_id, a.title, a.expires_at, a.listing_started_at
    from public.ads a
    where a.status in ('approved', 'expired')
      and a.deleted_at is null
      and a.expires_at is not null
      and a.expires_at <= now()
  loop
    v_expiry_cycle := coalesce(v_ad.listing_started_at, v_ad.expires_at);

    insert into public.notifications (user_id, type, title, body, related_ad_id, expiry_cycle)
    values (v_ad.user_id, 'expired',
      'Ad expired: ' || v_ad.title,
      'Your advertisement "' || v_ad.title || '" has expired. Renew it to make it active again.',
      v_ad.id,
      v_expiry_cycle
    )
    on conflict (user_id, related_ad_id, type, expiry_cycle) do nothing;
  end loop;
end;
$$;

-- 4. Fix complete_paid_order permissions - REVOKE from authenticated
-- Only service-role (webhook/server) should call this
revoke execute on function public.complete_paid_order(uuid, text, text, numeric) from authenticated;
revoke execute on function public.complete_paid_order(uuid, text, text) from authenticated;
revoke execute on function public.complete_paid_order(uuid, text) from authenticated;
revoke execute on function public.complete_paid_order(uuid) from authenticated;

-- Grant only to postgres (service role) and admin
grant execute on function public.complete_paid_order(uuid, text, text, numeric) to postgres;
grant execute on function public.complete_paid_order(uuid, text, text) to postgres;
grant execute on function public.complete_paid_order(uuid, text) to postgres;
grant execute on function public.complete_paid_order(uuid) to postgres;

-- 5. Also secure other payment-related functions
revoke execute on function public.create_boost_order(uuid, text) from authenticated;
revoke execute on function public.create_extension_order(uuid, text) from authenticated;
revoke execute on function public.check_boost_eligibility(uuid, uuid) from authenticated;
revoke execute on function public.check_extension_eligibility(uuid, uuid) from authenticated;
revoke execute on function public.complete_payment_and_apply_benefit(uuid, text, text, numeric) from authenticated;

grant execute on function public.create_boost_order(uuid, text) to postgres;
grant execute on function public.create_extension_order(uuid, text) to postgres;
grant execute on function public.check_boost_eligibility(uuid, uuid) to postgres;
grant execute on function public.check_extension_eligibility(uuid, uuid) to postgres;
grant execute on function public.complete_payment_and_apply_benefit(uuid, text, text, numeric) to postgres;

-- Note: The API routes use service-role key (via getSupabaseAdmin) so they can still call these functions.
-- The frontend (browser) uses anon key and cannot call them directly.

-- 6. Cron scheduling helper (run once in Supabase SQL Editor to set up)
-- These are idempotent - safe to run multiple times
-- Uncomment and run in Supabase Dashboard SQL Editor:
--
-- -- Expire due ads every 15 minutes
-- select cron.unschedule('expire-due-ads-every-15min') where exists (select 1 from cron.job where jobname = 'expire-due-ads-every-15min');
-- select cron.schedule('expire-due-ads-every-15min', '*/15 * * * *', $$ select public.expire_due_ads(); $$);
--
-- -- Send expiry notifications every hour
-- select cron.unschedule('expiry-notifications-hourly') where exists (select 1 from cron.job where jobname = 'expiry-notifications-hourly');
-- select cron.schedule('expiry-notifications-hourly', '0 * * * *', $$ select public.send_expiry_notifications(); $$);