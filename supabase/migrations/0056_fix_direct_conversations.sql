-- ============================================================
-- FindIt — Fix direct conversations for accepted connections
-- Run AFTER 0055. Idempotent.
--
-- Root cause addressed here:
--   * A connection is pair-level: `send_direct_connection_request`
--     treats any accepted request (including a listing request) as
--     ALREADY_CONNECTED, and username search shows any accepted request
--     as "Connected · Message".
--   * But 0055 only created a direct conversation when the accepted
--     request had listing_id IS NULL. Accepted listing requests were
--     therefore "connected" with no direct chat and no listing chat.
--
-- Fix:
--   * One direct conversation (ad_id IS NULL) per user pair, created
--     from ANY accepted connection request.
--   * Atomic create-or-get RPC for the browser.
--   * Accept RPC returns the direct conversation id.
--   * Direct messages stay free; listing conversations keep their paid
--     messaging entitlement.
--   * Backfills accepted connections that already have no direct chat.
-- ============================================================

begin;

-- ---------- 1. Nullable columns (idempotent) ----------
alter table public.connection_requests
  alter column listing_id drop not null;

alter table public.conversations
  alter column ad_id drop not null;

-- ---------- 2. Merge any duplicate direct conversations ----------
-- 0055 already added the partial unique index, so this is a no-op on a
-- healthy deployment. It keeps the migration safe on drifted databases
-- where duplicates were created before the index existed. Message
-- history is moved to the oldest conversation before duplicates are
-- removed; listing conversations are never touched.
do $$
declare
  v_has_dupes boolean;
  v_message_guard_disabled boolean := false;
begin
  select exists (
    select 1
      from public.conversations
     where ad_id is null
     group by least(buyer_id, seller_id), greatest(buyer_id, seller_id)
    having count(*) > 1
  ) into v_has_dupes;

  if not v_has_dupes then
    return;
  end if;

  if exists (
    select 1
      from pg_trigger
     where tgname = 'trg_guard_message_update'
       and tgrelid = 'public.messages'::regclass
       and tgenabled <> 'D'
  ) then
    execute 'alter table public.messages disable trigger trg_guard_message_update';
    v_message_guard_disabled := true;
  end if;

  with ranked as (
    select c.id,
           first_value(c.id) over (
             partition by least(c.buyer_id, c.seller_id), greatest(c.buyer_id, c.seller_id)
             order by c.created_at asc, c.id asc
           ) as keep_id,
           row_number() over (
             partition by least(c.buyer_id, c.seller_id), greatest(c.buyer_id, c.seller_id)
             order by c.created_at asc, c.id asc
           ) as rn
      from public.conversations c
     where c.ad_id is null
  )
  update public.messages m
     set conversation_id = r.keep_id
    from ranked r
   where m.conversation_id = r.id
     and r.rn > 1;

  with ranked as (
    select c.id,
           first_value(c.id) over (
             partition by least(c.buyer_id, c.seller_id), greatest(c.buyer_id, c.seller_id)
             order by c.created_at asc, c.id asc
           ) as keep_id
      from public.conversations c
     where c.ad_id is null
  )
  update public.conversations c
     set updated_at = greatest(
       c.updated_at,
       coalesce((select max(m.created_at) from public.messages m where m.conversation_id = c.id), c.updated_at)
     )
    from ranked r
   where c.id = r.keep_id;

  with ranked as (
    select c.id,
           row_number() over (
             partition by least(c.buyer_id, c.seller_id), greatest(c.buyer_id, c.seller_id)
             order by c.created_at asc, c.id asc
           ) as rn
      from public.conversations c
     where c.ad_id is null
  )
  delete from public.conversations c
   using ranked r
   where c.id = r.id
     and r.rn > 1;

  if v_message_guard_disabled then
    execute 'alter table public.messages enable trigger trg_guard_message_update';
  end if;
end $$;

-- ---------- 3. One direct conversation per user pair ----------
create unique index if not exists idx_direct_conversations_pair
  on public.conversations (least(buyer_id, seller_id), greatest(buyer_id, seller_id))
  where ad_id is null;

-- ---------- 4. Internal atomic create-or-get ----------
-- Only callable by the SECURITY DEFINER RPCs/triggers below. The insert
-- is still protected by guard_conversation(), which requires an accepted
-- connection request and no block between the participants.
create or replace function public.ensure_direct_conversation(
  p_user_a uuid,
  p_user_b uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if p_user_a is null or p_user_b is null then
    raise exception 'Both users are required' using errcode = '22023';
  end if;
  if p_user_a = p_user_b then
    raise exception 'SELF_CONNECTION' using errcode = '22023';
  end if;

  -- Serialize concurrent accepts/clicks for the same pair.
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(p_user_a::text, p_user_b::text)
        || ':' ||
      greatest(p_user_a::text, p_user_b::text),
      0
    )
  );

  select c.id
    into v_conversation_id
    from public.conversations c
   where c.ad_id is null
     and (
       (c.buyer_id = p_user_a and c.seller_id = p_user_b)
       or (c.buyer_id = p_user_b and c.seller_id = p_user_a)
     )
   order by c.created_at asc, c.id asc
   limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (ad_id, buyer_id, seller_id)
  values (null, least(p_user_a, p_user_b), greatest(p_user_a, p_user_b))
  returning id into v_conversation_id;

  return v_conversation_id;
exception
  when unique_violation then
    select c.id
      into v_conversation_id
      from public.conversations c
     where c.ad_id is null
       and (
         (c.buyer_id = p_user_a and c.seller_id = p_user_b)
         or (c.buyer_id = p_user_b and c.seller_id = p_user_a)
       )
     order by c.created_at asc, c.id asc
     limit 1;

    if v_conversation_id is null then
      raise;
    end if;
    return v_conversation_id;
end;
$$;

revoke all on function public.ensure_direct_conversation(uuid, uuid) from public;
revoke all on function public.ensure_direct_conversation(uuid, uuid) from anon;
revoke all on function public.ensure_direct_conversation(uuid, uuid) from authenticated;

-- ---------- 5. Browser-facing create-or-get RPC ----------
-- The caller cannot choose the other participant's identity beyond the
-- connected user id, and cannot create a chat without an accepted
-- connection request between the authenticated user and that user.
create or replace function public.get_or_create_direct_conversation(
  p_other_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_other uuid := p_other_user_id;
  v_conversation_id uuid;
begin
  if v_me is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_other is null or v_other = v_me then
    raise exception 'SELF_CONNECTION' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_other) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if exists (
    select 1
      from public.blocked_users bu
     where (bu.blocker_id = v_me and bu.blocked_id = v_other)
        or (bu.blocker_id = v_other and bu.blocked_id = v_me)
  ) then
    raise exception 'USER_BLOCKED' using errcode = '42501';
  end if;

  -- Any accepted request establishes the connection, whether it came
  -- from username search or from a listing's "Request to Connect".
  if not exists (
    select 1
      from public.connection_requests cr
     where cr.status = 'accepted'
       and (
         (cr.sender_id = v_me and cr.recipient_id = v_other)
         or (cr.sender_id = v_other and cr.recipient_id = v_me)
       )
  ) then
    raise exception 'NO_ACCEPTED_CONNECTION' using errcode = '42501';
  end if;

  v_conversation_id := public.ensure_direct_conversation(v_me, v_other);
  return v_conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public;
revoke all on function public.get_or_create_direct_conversation(uuid) from anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- ---------- 6. Conversation guard ----------
-- Direct conversations require an accepted connection between the exact
-- pair (not merely a listing request that was never accepted). Listing
-- conversations keep the existing paid entitlement check.
create or replace function public.guard_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
  v_check json;
begin
  if v_auth is null then
    raise exception 'Authentication required';
  end if;
  if new.buyer_id = new.seller_id then
    raise exception 'Cannot start a conversation with yourself';
  end if;
  if public.is_admin() or public.is_moderator() then
    return new;
  end if;
  if v_auth <> new.buyer_id and v_auth <> new.seller_id then
    raise exception 'Not permitted';
  end if;

  if new.ad_id is null then
    if not exists (
      select 1
        from public.connection_requests cr
       where cr.status = 'accepted'
         and (
           (cr.sender_id = new.buyer_id and cr.recipient_id = new.seller_id)
           or (cr.sender_id = new.seller_id and cr.recipient_id = new.buyer_id)
         )
    ) then
      raise exception 'NO_ACCEPTED_CONNECTION' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.blocked_users bu
       where (bu.blocker_id = new.buyer_id and bu.blocked_id = new.seller_id)
          or (bu.blocker_id = new.seller_id and bu.blocked_id = new.buyer_id)
    ) then
      raise exception 'USER_BLOCKED' using errcode = '42501';
    end if;
    return new;
  end if;

  v_check := public.can_start_conversation(new.buyer_id, new.seller_id, new.ad_id);
  if not (v_check->>'allowed')::boolean then
    raise exception '%', v_check->>'reason' using errcode = '45000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_conversation on public.conversations;
create trigger trg_guard_conversation
before insert on public.conversations
for each row execute function public.guard_conversation();

-- ---------- 7. Acceptance creates the direct conversation ----------
-- Any accepted request creates/uses the pair's single direct chat. A
-- listing conversation, if later opened by a paid buyer, remains a
-- separate ad-scoped conversation.
create or replace function public.create_direct_connection_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'accepted' and new.sender_id <> new.recipient_id then
    perform public.ensure_direct_conversation(new.sender_id, new.recipient_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_create_direct_connection_conversation on public.connection_requests;
create trigger trg_create_direct_connection_conversation
after insert or update on public.connection_requests
for each row execute function public.create_direct_connection_conversation();

-- ---------- 8. Respond RPC returns the conversation id ----------
create or replace function public.respond_to_connection_request(
  p_request_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.connection_requests%rowtype;
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('accept', 'decline') then
    raise exception 'Invalid action' using errcode = '22023';
  end if;

  select * into v_request
    from public.connection_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_request.recipient_id <> v_user_id then
    raise exception 'Only the recipient can respond' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Request is no longer pending' using errcode = '40001';
  end if;

  update public.connection_requests
     set status = case when p_action = 'accept' then 'accepted' else 'declined' end,
         responded_at = now(),
         updated_at = now()
   where id = p_request_id
   returning * into v_request;

  if p_action = 'accept' then
    -- Idempotent: returns the existing direct conversation or creates it.
    v_conversation_id := public.ensure_direct_conversation(
      v_request.sender_id,
      v_request.recipient_id
    );
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'respondedAt', v_request.responded_at,
    'senderId', v_request.sender_id,
    'recipientId', v_request.recipient_id,
    'listingId', v_request.listing_id,
    'initialMessage', v_request.initial_message,
    'createdAt', v_request.created_at,
    'updatedAt', v_request.updated_at,
    'conversationId', v_conversation_id,
    'action', p_action
  );
end;
$$;

revoke all on function public.respond_to_connection_request(uuid, text) from public;
revoke all on function public.respond_to_connection_request(uuid, text) from anon;
grant execute on function public.respond_to_connection_request(uuid, text) to authenticated;

-- ---------- 9. Message entitlement ----------
-- Direct chats are free for accepted connections. Only ad-scoped chats
-- keep the buyer's paid messaging requirement; sellers can still reply.
create or replace function public.guard_message_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv public.conversations%rowtype;
  v_has_sub boolean;
begin
  if me is null then
    raise exception 'Authentication required';
  end if;

  select * into conv from public.conversations where id = new.conversation_id;
  if not found then
    raise exception 'Conversation not found';
  end if;
  if me <> conv.buyer_id and me <> conv.seller_id then
    raise exception 'Not a participant of this conversation';
  end if;
  new.sender_id := me;

  if exists (
    select 1 from public.blocked_users bu
     where (bu.blocker_id = conv.buyer_id and bu.blocked_id = conv.seller_id)
        or (bu.blocker_id = conv.seller_id and bu.blocked_id = conv.buyer_id)
  ) then
    raise exception 'User blocked';
  end if;

  if conv.ad_id is null then
    if not exists (
      select 1
        from public.connection_requests cr
       where cr.status = 'accepted'
         and (
           (cr.sender_id = conv.buyer_id and cr.recipient_id = conv.seller_id)
           or (cr.sender_id = conv.seller_id and cr.recipient_id = conv.buyer_id)
         )
    ) then
      raise exception 'Accepted connection required';
    end if;
  elsif me = conv.buyer_id then
    select public.has_active_messaging_subscription(me) into v_has_sub;
    if not v_has_sub then
      raise exception 'Active messaging subscription required to send messages';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_message_entitlement on public.messages;
create trigger trg_guard_message_entitlement
before insert on public.messages
for each row execute function public.guard_message_entitlement();

-- ---------- 10. Backfill accepted connections with no direct chat ----------
-- This repairs connections accepted before this fix, including the
-- reported production case (an accepted listing request with no chat).
-- guard_conversation() needs auth.uid(); migrations have no JWT, so the
-- trigger is disabled only for this trusted set-based insert.
do $$
declare
  v_guard_disabled boolean := false;
begin
  if exists (
    select 1
      from pg_trigger
     where tgname = 'trg_guard_conversation'
       and tgrelid = 'public.conversations'::regclass
       and tgenabled <> 'D'
  ) then
    execute 'alter table public.conversations disable trigger trg_guard_conversation';
    v_guard_disabled := true;
  end if;

  insert into public.conversations (ad_id, buyer_id, seller_id)
  select distinct
         null::uuid,
         least(cr.sender_id, cr.recipient_id),
         greatest(cr.sender_id, cr.recipient_id)
    from public.connection_requests cr
   where cr.status = 'accepted'
     and cr.sender_id <> cr.recipient_id
     and not exists (
       select 1
         from public.conversations c
        where c.ad_id is null
          and (
            (c.buyer_id = cr.sender_id and c.seller_id = cr.recipient_id)
            or (c.buyer_id = cr.recipient_id and c.seller_id = cr.sender_id)
          )
     )
  on conflict do nothing;

  if v_guard_disabled then
    execute 'alter table public.conversations enable trigger trg_guard_conversation';
  end if;
end $$;

-- ---------- 11. Realtime ----------
do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.connection_requests;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Tell PostgREST about the new RPC immediately.
notify pgrst, 'reload schema';

commit;
