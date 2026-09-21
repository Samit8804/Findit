-- ============================================================
-- FindIt — Fix automatic expiry + expiry notifications + cron setup
-- Safe forward migration: does not rewrite applied history.
-- ============================================================

-- Ensure notification columns exist for expiry/event deduplication.
alter table public.notifications
add column if not exists related_ad_id uuid references public.ads (id) on delete set null;

alter table public.notifications
  add column if not exists data jsonb default '{}'::jsonb;

alter table public.notifications
add column if not exists expiry_cycle timestamptz;

-- Idempotent unique guard for expiry notifications.
create unique index if not exists uniq_notification_per_cycle
  on public.notifications (user_id, related_ad_id, type, expiry_cycle)
  where type in ('expiring_soon', 'expired');

-- Expire due ads: use <= now() for the actual expiry boundary, and do not duplicate work.
create or replace function public.expire_due_ads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad record;
begin
  for v_ad in
    select a.id, a.user_id, a.title, a.expires_at, a.listing_started_at
    from public.ads a
    where a.status = 'approved'
      and a.deleted_at is null
      and a.expires_at is not null
      and a.expires_at <= now()
  loop
    update public.ads
       set status = 'expired',
           updated_at = now()
     where id = v_ad.id
       and status = 'approved';

    insert into public.notifications (user_id, type, title, body, related_ad_id, expiry_cycle)
    values (
      v_ad.user_id,
      'expired',
      'Ad expired: ' || v_ad.title,
      'Your advertisement "' || v_ad.title || '" has expired. Renew it to make it active again.',
      v_ad.id,
      coalesce(v_ad.listing_started_at, v_ad.expires_at)
    )
    on conflict (user_id, related_ad_id, type, expiry_cycle) do nothing;
  end loop;
end;
$$;

-- Expiring-soon + expired notifications with dedupe per expiry cycle.
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
  -- Expiring soon: only within the final 24 hours before expiry.
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

  -- For expired ads that were not processed by the cron run yet.
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

-- Ensure pg_cron is available before scheduling jobs.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end $$;

-- Create cron jobs idempotently. They must not be duplicated.
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