-- ============================================================
-- FindIt — Notifications System with Expiry Cron
-- Run AFTER 0019_paid_plans_boost_extension. Idempotent.
-- ============================================================

-- 1. Ensure notifications table has all needed columns
alter table public.notifications add column if not exists related_ad_id uuid references public.ads(id) on delete set null;
alter table public.notifications add column if not exists data jsonb default '{}'::jsonb;

-- 2. RLS policies for notifications
alter table public.notifications enable row level security;
drop policy if exists "notifications_owner_read" on public.notifications;
create policy "notifications_owner_read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications_system_write" on public.notifications;
create policy "notifications_system_write" on public.notifications for insert with check (public.is_admin() or current_user = 'postgres');
drop policy if exists "notifications_owner_update" on public.notifications;
create policy "notifications_owner_update" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Indexes for notifications
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_notifications_ad on public.notifications(related_ad_id);
create index if not exists idx_notifications_type on public.notifications(type);

-- 4. Function to send expiry notifications (called by cron)
create or replace function public.send_expiry_notifications()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ads record;
  v_days_remaining int;
begin
  -- Expiring soon (24 hours): expires_at between now() and now() + 24 hours
  for v_ads in
    select a.id, a.user_id, a.title, a.expires_at
    from public.ads a
    where a.status = 'approved'
      and a.deleted_at is null
      and a.expires_at is not null
      and a.expires_at > now()
      and a.expires_at <= now() + interval '24 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = a.user_id
          and n.related_ad_id = a.id
          and n.type = 'expiring_soon'
          and n.created_at > now() - interval '24 hours'
      )
  loop
    v_days_remaining := floor(extract(epoch from (v_ads.expires_at - now())) / 86400);
    insert into public.notifications (user_id, type, title, body, related_ad_id)
    values (v_ads.user_id, 'expiring_soon',
      'Ad expiring soon: ' || v_ads.title,
      'Your advertisement "' || v_ads.title || '" expires in ' || v_days_remaining || ' day(s). Renew now to keep it active.',
      v_ads.id);
  end loop;

  -- Expired ads: expires_at <= now()
  for v_ads in
    select a.id, a.user_id, a.title, a.expires_at
    from public.ads a
    where a.status = 'approved'
      and a.deleted_at is null
      and a.expires_at is not null
      and a.expires_at <= now()
      and not exists (
        select 1 from public.notifications n
        where n.user_id = a.user_id
          and n.related_ad_id = a.id
          and n.type = 'expired'
          and n.created_at > now() - interval '24 hours'
      )
  loop
    insert into public.notifications (user_id, type, title, body, related_ad_id)
    values (v_ads.user_id, 'expired',
      'Ad expired: ' || v_ads.title,
      'Your advertisement "' || v_ads.title || '" has expired. Renew it to make it active again.',
      v_ads.id);
  end loop;
end;
$$;

-- 5. Function to expire due ads (called by cron)
create or replace function public.expire_due_ads()
returns void language sql security definer set search_path = public as $$
  update public.ads
     set status = 'expired'
   where status = 'approved'
     and expires_at is not null
     and expires_at < now();
$$;

-- 6. Supabase Cron jobs (run via Supabase Dashboard or pg_cron)
-- Note: These require Supabase Cron extension. Create via Supabase Dashboard SQL Editor:
--
-- select cron.schedule('expire-due-ads-every-15min', '*/15 * * * *', $$ select public.expire_due_ads(); $$);
-- select cron.schedule('expiry-notifications-hourly', '0 * * * *', $$ select public.send_expiry_notifications(); $$);