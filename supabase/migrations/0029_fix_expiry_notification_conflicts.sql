-- FindIt - Fix partial-index conflict targets for expiry notifications.
-- Run after 0028. Safe to rerun.

create unique index if not exists uniq_notification_per_cycle
  on public.notifications (user_id, related_ad_id, type, expiry_cycle)
  where type in ('expiring_soon', 'expired');

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
      v_ad.expires_at
    )
    on conflict (user_id, related_ad_id, type, expiry_cycle)
      where type in ('expiring_soon', 'expired')
      do nothing;
  end loop;
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
  v_message text;
begin
  for v_ad in
    select a.id, a.user_id, a.title, a.expires_at
    from public.ads a
    where a.status = 'approved'
      and a.deleted_at is null
      and a.expires_at is not null
      and a.expires_at > now()
      and a.expires_at <= now() + interval '24 hours'
  loop
    v_hours_remaining := extract(epoch from (v_ad.expires_at - now())) / 3600;

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
      v_ad.expires_at
    )
    on conflict (user_id, related_ad_id, type, expiry_cycle)
      where type in ('expiring_soon', 'expired')
      do nothing;
  end loop;

  for v_ad in
    select a.id, a.user_id, a.title, a.expires_at
    from public.ads a
    where a.status in ('approved', 'expired')
      and a.deleted_at is null
      and a.expires_at is not null
      and a.expires_at <= now()
  loop
    insert into public.notifications (user_id, type, title, body, related_ad_id, expiry_cycle)
    values (v_ad.user_id, 'expired',
      'Ad expired: ' || v_ad.title,
      'Your advertisement "' || v_ad.title || '" has expired. Renew it to make it active again.',
      v_ad.id,
      v_ad.expires_at
    )
    on conflict (user_id, related_ad_id, type, expiry_cycle)
      where type in ('expiring_soon', 'expired')
      do nothing;
  end loop;
end;
$$;