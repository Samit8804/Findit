-- ============================================================
-- FindIt — Messaging Entitlement + Conversation Authorization
-- Run AFTER 0048. Idempotent.
-- ============================================================

-- ---------- RPC: has_active_messaging_subscription ----------
-- Returns true if the authenticated user has an active, non-expired
-- business subscription that includes messaging access.
-- Uses only trusted database records (user_subscriptions), never client-supplied data.
create or replace function public.has_active_messaging_subscription(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.user_subscriptions us
  where us.user_id = p_user_id
    and us.status = 'active'
    and (us.ends_at is null or us.ends_at > now());

  if v_count > 0 then
    return true;
  end if;

  return false;
end;
$$;

-- ---------- RPC: can_start_conversation ----------
-- Comprehensive server-side check before allowing a conversation to be created.
-- Verifies: accepted connection request, active messaging entitlement,
-- no blocks, correct participants, valid listing.
create or replace function public.can_start_conversation(
  p_buyer_id uuid,
  p_seller_id uuid,
  p_listing_id uuid
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing_owner uuid;
  v_has_request boolean;
  v_has_subscription boolean;
  v_blocked boolean;
  v_reason text;
begin
  -- 1. Buyer and seller must be different
  if p_buyer_id = p_seller_id then
    return json_build_object('allowed', false, 'reason', 'Cannot start a conversation with yourself');
  end if;

  -- 2. Listing must exist and be owned by the seller
  select user_id into v_listing_owner from public.ads where id = p_listing_id;
  if not found then
    return json_build_object('allowed', false, 'reason', 'Listing not found');
  end if;
  if v_listing_owner <> p_seller_id then
    return json_build_object('allowed', false, 'reason', 'Listing does not belong to this seller');
  end if;

  -- 3. No mutual blocks
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = p_buyer_id and blocked_id = p_seller_id)
       or (blocker_id = p_seller_id and blocked_id = p_buyer_id)
  ) into v_blocked;
  if v_blocked then
    return json_build_object('allowed', false, 'reason', 'Users are blocked from connecting');
  end if;

  -- 4. An accepted connection request must exist
  select exists (
    select 1 from public.connection_requests
    where sender_id = p_buyer_id
      and recipient_id = p_seller_id
      and listing_id = p_listing_id
      and status = 'accepted'
  ) into v_has_request;
  if not v_has_request then
    return json_build_object('allowed', false, 'reason', 'No accepted connection request for this listing');
  end if;

  -- 5. Buyer must have an active messaging subscription
  select public.has_active_messaging_subscription(p_buyer_id) into v_has_subscription;
  if not v_has_subscription then
    return json_build_object('allowed', false, 'reason', 'Active messaging subscription required');
  end if;

  return json_build_object('allowed', true, 'reason', 'Authorized');
end;
$$;

-- ---------- CONVERSATION GUARD: enforce entitlement + accepted request ----------
-- Replace the existing guard_conversation with a stricter version that requires
-- an accepted connection request and active messaging subscription for the buyer.
create or replace function public.guard_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
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

  -- Admins/mods can create conversations directly (for moderation purposes)
  if public.is_admin() or public.is_moderator() then
    return new;
  end if;

  -- Only the buyer or seller can initiate
  if v_auth <> new.buyer_id and v_auth <> new.seller_id then
    raise exception 'Not permitted';
  end if;

  -- Run the comprehensive authorization check
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

-- ---------- MESSAGE GUARD: enforce entitlement on send ----------
-- Strengthen the existing guard_message_blocks to also require
-- active messaging subscription from the sender if they are the buyer.
create or replace function public.guard_message_entitlement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv record;
  v_has_sub boolean;
begin
  if me is null then raise exception 'Authentication required'; end if;

  select * into conv from public.conversations where id = new.conversation_id;
  if not found then raise exception 'Conversation not found'; end if;

  -- Only participants can send
  if me <> conv.buyer_id and me <> conv.seller_id then
    raise exception 'Not a participant of this conversation';
  end if;

  -- Sender always comes from the session
  new.sender_id := me;

  -- Block enforcement
  if exists (
    select 1 from public.blocked_users
    where (blocker_id = conv.buyer_id and blocked_id = conv.seller_id)
       or (blocker_id = conv.seller_id and blocked_id = conv.buyer_id)
  ) then
    raise exception 'User blocked';
  end if;

  -- Buyer must have active messaging subscription to send messages
  if me = conv.buyer_id then
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

-- ---------- INDEXES ----------
create index if not exists idx_user_subs_active on public.user_subscriptions(user_id, status, ends_at);
