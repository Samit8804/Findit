-- ============================================================
-- FindIt — Connection Requests (subscription-gated messaging)
-- Run AFTER 0047. Idempotent.
-- ============================================================

-- ---------- TABLE: connection_requests ----------
create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.ads(id) on delete cascade,
  initial_message text not null check (char_length(btrim(initial_message)) between 1 and 500),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(sender_id, recipient_id, listing_id, status)
    where status in ('pending','accepted')
);

-- ---------- INDEXES ----------
create index if not exists idx_cr_sender on public.connection_requests(sender_id, created_at desc);
create index if not exists idx_cr_recipient on public.connection_requests(recipient_id, status, created_at desc);
create index if not exists idx_cr_listing on public.connection_requests(listing_id);
create index if not exists idx_cr_status on public.connection_requests(status);

-- ---------- RLS ----------
alter table public.connection_requests enable row level security;

drop policy if exists "cr_sender_own_all" on public.connection_requests;
create policy "cr_sender_own_all" on public.connection_requests for all
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);

drop policy if exists "cr_recipient_read" on public.connection_requests;
create policy "cr_recipient_read" on public.connection_requests for select
using (auth.uid() = recipient_id);

drop policy if exists "cr_recipient_update_status" on public.connection_requests;
create policy "cr_recipient_update_status" on public.connection_requests for update
using (auth.uid() = recipient_id)
with check (
  auth.uid() = recipient_id
  and status in ('accepted','declined')
  and (old.status is distinct from new.status or old.responded_at is distinct from new.responded_at)
);

-- Admins can read all
drop policy if exists "cr_admin_all" on public.connection_requests;
create policy "cr_admin_all" on public.connection_requests for all
using (public.is_admin());

-- ---------- VALIDATION FUNCTIONS ----------
-- Validate that recipient owns the listing and sender is not the recipient
create or replace function public.validate_connection_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ad_owner uuid;
  existing_pending int;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Authentication required';
  end if;

  -- Sender cannot be the recipient
  if new.sender_id = new.recipient_id then
    raise exception 'Cannot send a connection request to yourself';
  end if;

  -- Recipient must own the listing
  select user_id into ad_owner from public.ads where id = new.listing_id;
  if not found then
    raise exception 'Listing not found';
  end if;
  if ad_owner <> new.recipient_id then
    raise exception 'Recipient does not own this listing';
  end if;

  -- Blocked-user restriction
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = new.sender_id and blocked_id = new.recipient_id)
       or (blocker_id = new.recipient_id and blocked_id = new.sender_id)
  ) then
    raise exception 'Users are blocked from connecting';
  end if;

  -- Prevent duplicate active requests for the same connection
  if TG_OP = 'INSERT' then
    select count(*) into existing_pending
    from public.connection_requests
    where sender_id = new.sender_id
      and recipient_id = new.recipient_id
      and listing_id = new.listing_id
      and status in ('pending','accepted');
    if existing_pending > 0 then
      raise exception 'An active connection request already exists for this listing';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_connection_request on public.connection_requests;
create trigger trg_validate_connection_request
before insert on public.connection_requests
for each row execute function public.validate_connection_request();

-- Prevent downgrading accepted -> pending (only recipient can change pending -> accepted/declined)
create or replace function public.guard_connection_request_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;

  -- Only the recipient can update status
  if me <> old.recipient_id then
    raise exception 'Only the recipient can respond to this request';
  end if;

  -- Only pending can be transitioned
  if old.status <> 'pending' then
    raise exception 'Only pending requests can be accepted or declined';
  end if;

  -- New status must be accepted or declined
  if new.status not in ('accepted','declined') then
    raise exception 'Request can only be accepted or declined';
  end if;

  -- Set responded_at
  new.responded_at := now();
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_guard_connection_request_update on public.connection_requests;
create trigger trg_guard_connection_request_update
before update on public.connection_requests
for each row execute function public.guard_connection_request_update();

-- ---------- NOTIFICATION TRIGGER ----------
create or replace function public.notify_connection_request_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
  listing_title text;
begin
  select p.name into sender_name
  from public.profiles p where p.id = new.sender_id;

  select a.title into listing_title
  from public.ads a where a.id = new.listing_id;

  if TG_OP = 'INSERT' then
    -- Notify recipient of new connection request
    perform public.notify_user(
      new.recipient_id,
      'connection_request',
      'New connection request',
      coalesce(sender_name, 'A user') || ' wants to connect about "' || coalesce(listing_title, 'your listing') || '".',
      jsonb_build_object('connection_request_id', new.id, 'listing_id', new.listing_id, 'sender_id', new.sender_id)
    );
  elsif TG_OP = 'UPDATE' then
    if old.status is distinct from new.status then
      if new.status = 'accepted' then
        -- Notify sender that request was accepted
        perform public.notify_user(
          new.sender_id,
          'connection_request_accepted',
          'Connection request accepted',
          coalesce((select name from public.profiles where id = new.recipient_id), 'The seller') || ' accepted your request.',
          jsonb_build_object('connection_request_id', new.id, 'listing_id', new.listing_id, 'recipient_id', new.recipient_id)
        );
      elsif new.status = 'declined' then
        perform public.notify_user(
          new.sender_id,
          'connection_request_declined',
          'Connection request declined',
          'Your connection request was declined.',
          jsonb_build_object('connection_request_id', new.id, 'listing_id', new.listing_id, 'recipient_id', new.recipient_id)
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_connection_request on public.connection_requests;
create trigger trg_notify_connection_request
after insert or update on public.connection_requests
for each row execute function public.notify_connection_request_event();

-- ---------- REALTIME ----------
do $$
begin
  alter publication supabase_realtime add table public.connection_requests;
exception when duplicate_object then null; when undefined_object then null; end $$;
