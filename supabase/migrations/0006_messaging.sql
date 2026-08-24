-- ============================================================
-- FindIt — Real messaging: conversations, messages, blocks, reports
-- Run AFTER 0001-0005. Idempotent where safe.
-- ============================================================

-- ---------- TABLES ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ad_id, buyer_id),
  check (buyer_id <> seller_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete set null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  description text,
  created_at timestamptz not null default now()
);

-- notifications.data for click-through context
alter table public.notifications add column if not exists data jsonb not null default '{}'::jsonb;

-- ---------- INDEXES ----------
create index if not exists idx_conv_buyer on public.conversations(buyer_id);
create index if not exists idx_conv_seller on public.conversations(seller_id);
create index if not exists idx_conv_ad on public.conversations(ad_id);
create index if not exists idx_conv_updated on public.conversations(updated_at desc);
create index if not exists idx_msg_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_msg_unread on public.messages(conversation_id) where is_read = false;
create index if not exists idx_notif_user_read on public.notifications(user_id, read, created_at desc);
create index if not exists idx_blocked_blocker on public.blocked_users(blocker_id);

-- ---------- TRIGGERS ----------
-- Keep conversations.updated_at fresh
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation on public.messages;
create trigger trg_touch_conversation after insert on public.messages
for each row execute function public.touch_conversation();

-- Notify recipient + basic rate limit (max 20 msgs/min per sender)
create or replace function public.on_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv public.conversations%rowtype;
  recipient uuid;
  recent int;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  recipient := case when new.sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end;

  -- rate limit
  select count(*) into recent from public.messages
   where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent > 20 then
    raise exception 'Sending too many messages. Slow down.';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    recipient,
    'new_message',
    'New message from ' || coalesce((select name from public.profiles where id = new.sender_id), 'a user'),
    left(new.message, 80),
    jsonb_build_object('conversation_id', new.conversation_id, 'ad_id', conv.ad_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message after insert on public.messages
for each row execute function public.on_new_message();

-- Block enforcement: participants must not have blocked each other
create or replace function public.guard_message_blocks()
returns trigger language plpgsql security definer set search_path = public as $$
declare conv record; me uuid := auth.uid();
begin
  if me is null then raise exception 'Authentication required'; end if;
  select * into conv from public.conversations where id = new.conversation_id;
  if conv.id is null then raise exception 'Conversation not found'; end if;
  if me <> conv.buyer_id and me <> conv.seller_id then
    raise exception 'Not a participant of this conversation';
  end if;
  new.sender_id := me; -- sender always comes from the session

  if exists (select 1 from public.blocked_users
             where (blocker_id = conv.buyer_id and blocked_id = conv.seller_id)
                or (blocker_id = conv.seller_id and blocked_id = conv.buyer_id)) then
    raise exception 'User blocked';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_message on public.messages;
create trigger trg_guard_message before insert on public.messages
for each row execute function public.guard_message_blocks();

-- Conversation guard: no self-conversations, participant-only creation
create or replace function public.guard_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if new.buyer_id = new.seller_id then
    raise exception 'Cannot start a conversation with yourself';
  end if;
  if auth.uid() <> new.buyer_id and auth.uid() <> new.seller_id and not public.is_admin() then
    raise exception 'Not permitted';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_conversation on public.conversations;
create trigger trg_guard_conversation before insert on public.conversations
for each row execute function public.guard_conversation();

-- Messages: recipients may only flip is_read to true; senders cannot edit/delete history
create or replace function public.guard_message_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare conv record; me uuid := auth.uid();
begin
  select * into conv from public.conversations where id = old.conversation_id;
  if me is null or (me <> conv.buyer_id and me <> conv.seller_id) then
    raise exception 'Not permitted';
  end if;
  if new.sender_id <> old.sender_id or new.message <> old.message or new.created_at <> old.created_at then
    raise exception 'Messages are immutable';
  end if;
  -- only the recipient can mark read
  if me = old.sender_id and new.is_read <> old.is_read then
    raise exception 'Sender cannot mark own message read';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_message_update on public.messages;
create trigger trg_guard_message_update before update on public.messages
for each row execute function public.guard_message_update();

-- ---------- RLS ----------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocked_users enable row level security;
alter table public.message_reports enable row level security;

drop policy if exists "conv_participant_read" on public.conversations;
create policy "conv_participant_read" on public.conversations for select
using (auth.uid() = buyer_id or auth.uid() = seller_id or public.is_admin());

drop policy if exists "conv_participant_insert" on public.conversations;
create policy "conv_participant_insert" on public.conversations for insert to authenticated
with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "conv_participant_update" on public.conversations;
create policy "conv_participant_update" on public.conversations for update
using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "msg_participant_read" on public.messages;
create policy "msg_participant_read" on public.messages for select
using (exists (select 1 from public.conversations c
               where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));

drop policy if exists "msg_participant_insert" on public.messages;
create policy "msg_participant_insert" on public.messages for insert to authenticated
with check (exists (select 1 from public.conversations c
                    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid()))
            and sender_id = auth.uid());

drop policy if exists "msg_recipient_update" on public.messages;
create policy "msg_recipient_update" on public.messages for update
using (exists (select 1 from public.conversations c
               where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));

drop policy if exists "blocks_own_all" on public.blocked_users;
create policy "blocks_own_all" on public.blocked_users for all
using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

drop policy if exists "mreports_own_insert" on public.message_reports;
create policy "mreports_own_insert" on public.message_reports for insert to authenticated
with check (reporter_id = auth.uid());
drop policy if exists "mreports_admin_read" on public.message_reports;
create policy "mreports_admin_read" on public.message_reports for select using (public.is_admin());

-- ---------- REALTIME ----------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null; when undefined_object then null; end $$;