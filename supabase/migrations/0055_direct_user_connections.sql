-- Direct user connections from username search.
-- Existing listing-based requests and conversations retain their current rules.

alter table public.connection_requests
  alter column listing_id drop not null;

alter table public.conversations
  alter column ad_id drop not null;

create unique index if not exists idx_cr_one_active_direct_request
  on public.connection_requests(sender_id, recipient_id)
  where listing_id is null and status in ('pending', 'accepted');

create index if not exists idx_profiles_username_prefix
  on public.profiles (lower(username) text_pattern_ops)
  where username is not null;

create or replace function public.search_public_users(
  p_query text,
  p_limit int default 10
)
returns table (
  id uuid,
  username text,
  display_name text,
  name text,
  avatar_url text,
  location_text text,
  account_type text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(v_query) < 2
     or length(v_query) > 30
     or v_query !~ '^[a-z0-9-]+$' then
    return;
  end if;

  return query
    select p.id,
           p.username,
           p.display_name,
           p.name,
           p.avatar_url,
           case
             when p.privacy_address in ('public', 'registered_users') then p.location_text
             else null
           end,
           p.account_type
      from public.profiles p
     where p.id <> auth.uid()
       and p.username is not null
       and lower(p.username) like v_query || '%'
     order by (lower(p.username) = v_query) desc, lower(p.username)
     limit least(greatest(coalesce(p_limit, 10), 1), 20);
end;
$$;

revoke all on function public.search_public_users(text, int) from public;
revoke all on function public.search_public_users(text, int) from anon;
grant execute on function public.search_public_users(text, int) to authenticated;

create or replace function public.validate_connection_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ad_owner uuid;
  me uuid := auth.uid();
begin
  if me is null or me <> new.sender_id then
    raise exception 'Authenticated sender must match the request sender'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' and new.status <> 'pending' then
    raise exception 'New connection requests must be pending';
  end if;

  if new.sender_id = new.recipient_id then
    raise exception 'Cannot send a connection request to yourself';
  end if;

  if new.listing_id is not null then
    select a.user_id
      into ad_owner
      from public.ads a
     where a.id = new.listing_id
       and a.deleted_at is null;

    if not found then
      raise exception 'Listing not found';
    end if;
    if ad_owner <> new.recipient_id then
      raise exception 'Recipient does not own this listing';
    end if;
  else
    perform pg_advisory_xact_lock(
      hashtextextended(
        least(new.sender_id::text, new.recipient_id::text)
          || ':' ||
        greatest(new.sender_id::text, new.recipient_id::text),
        0
      )
    );

    if exists (
      select 1
        from public.connection_requests cr
       where cr.status in ('pending', 'accepted')
         and (
           (cr.sender_id = new.sender_id and cr.recipient_id = new.recipient_id)
           or (cr.sender_id = new.recipient_id and cr.recipient_id = new.sender_id)
         )
    ) then
      raise exception 'An active connection request already exists for these users'
        using errcode = '23505';
    end if;
  end if;

  if exists (
    select 1
      from public.blocked_users bu
     where (bu.blocker_id = new.sender_id and bu.blocked_id = new.recipient_id)
        or (bu.blocker_id = new.recipient_id and bu.blocked_id = new.sender_id)
  ) then
    raise exception 'Users are blocked from connecting';
  end if;

  return new;
end;
$$;

create or replace function public.send_direct_connection_request(p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_sender_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_recipient_id is null or p_recipient_id = v_sender_id then
    raise exception 'Cannot send a connection request to yourself';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(v_sender_id::text, p_recipient_id::text)
        || ':' ||
      greatest(v_sender_id::text, p_recipient_id::text),
      0
    )
  );

  if not exists (
    select 1 from public.profiles p
     where p.id = p_recipient_id
       and p.username is not null
  ) then
    raise exception 'User not found';
  end if;

  if exists (
    select 1
      from public.blocked_users bu
     where (bu.blocker_id = v_sender_id and bu.blocked_id = p_recipient_id)
        or (bu.blocker_id = p_recipient_id and bu.blocked_id = v_sender_id)
  ) then
    raise exception 'Users are blocked from connecting';
  end if;

  if exists (
    select 1 from public.connection_requests cr
     where cr.status = 'accepted'
       and (
         (cr.sender_id = v_sender_id and cr.recipient_id = p_recipient_id)
         or (cr.sender_id = p_recipient_id and cr.recipient_id = v_sender_id)
       )
  ) then
    raise exception 'ALREADY_CONNECTED' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.connection_requests cr
     where cr.status = 'pending'
       and cr.sender_id = v_sender_id
       and cr.recipient_id = p_recipient_id
  ) then
    raise exception 'REQUEST_ALREADY_SENT' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.connection_requests cr
     where cr.status = 'pending'
       and cr.sender_id = p_recipient_id
       and cr.recipient_id = v_sender_id
  ) then
    raise exception 'INCOMING_REQUEST_EXISTS' using errcode = '23505';
  end if;

  insert into public.connection_requests (
    sender_id, recipient_id, listing_id, initial_message, status
  )
  values (
    v_sender_id, p_recipient_id, null, 'I would like to connect with you.', 'pending'
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.send_direct_connection_request(uuid) from public;
revoke all on function public.send_direct_connection_request(uuid) from anon;
grant execute on function public.send_direct_connection_request(uuid) to authenticated;

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

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'respondedAt', v_request.responded_at,
    'senderId', v_request.sender_id,
    'recipientId', v_request.recipient_id,
    'listingId', v_request.listing_id,
    'action', p_action
  );
end;
$$;

revoke all on function public.respond_to_connection_request(uuid, text) from public;
revoke all on function public.respond_to_connection_request(uuid, text) from anon;
grant execute on function public.respond_to_connection_request(uuid, text) to authenticated;

create or replace function public.guard_connection_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if me <> old.recipient_id then
    raise exception 'Only the recipient can respond to this request' using errcode = '42501';
  end if;
  if old.status <> 'pending' then
    raise exception 'Only pending requests can be accepted or declined';
  end if;
  if new.status not in ('accepted', 'declined') then
    raise exception 'Request can only be accepted or declined';
  end if;
  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.listing_id is distinct from old.listing_id
     or new.initial_message is distinct from old.initial_message
     or new.created_at is distinct from old.created_at then
    raise exception 'Connection request details cannot be changed';
  end if;

  new.responded_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.notify_connection_request_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  listing_title text;
begin
  select p.display_name
    into sender_name
    from public.profiles p
   where p.id = new.sender_id;
  sender_name := coalesce(sender_name, (select p.name from public.profiles p where p.id = new.sender_id));

  if new.listing_id is not null then
    select a.title into listing_title
      from public.ads a
     where a.id = new.listing_id;
  end if;

  if tg_op = 'INSERT' then
    perform public.notify_user(
      new.recipient_id,
      'connection_request',
      'New connection request',
      case
        when new.listing_id is null then coalesce(sender_name, 'A user') || ' wants to connect with you.'
        else coalesce(sender_name, 'A user') || ' wants to connect about "' || coalesce(listing_title, 'your listing') || '".'
      end,
      jsonb_build_object(
        'connection_request_id', new.id,
        'listing_id', new.listing_id,
        'sender_id', new.sender_id
      )
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'accepted' then
      perform public.notify_user(
        new.sender_id,
        'connection_request_accepted',
        'Connection request accepted',
        coalesce(
          (select coalesce(p.display_name, p.name) from public.profiles p where p.id = new.recipient_id),
          'The user'
        ) || ' accepted your request.',
        jsonb_build_object(
          'connection_request_id', new.id,
          'listing_id', new.listing_id,
          'recipient_id', new.recipient_id
        )
      );
    elsif new.status = 'declined' then
      perform public.notify_user(
        new.sender_id,
        'connection_request_declined',
        'Connection request declined',
        'Your connection request was declined.',
        jsonb_build_object(
          'connection_request_id', new.id,
          'listing_id', new.listing_id,
          'recipient_id', new.recipient_id
        )
      );
    end if;
  end if;

  return new;
end;
$$;

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
       where cr.listing_id is null
         and cr.status = 'accepted'
         and cr.sender_id in (new.buyer_id, new.seller_id)
         and cr.recipient_id in (new.buyer_id, new.seller_id)
         and cr.sender_id <> cr.recipient_id
    ) then
      raise exception 'No accepted direct connection request';
    end if;
    if exists (
      select 1 from public.blocked_users bu
       where (bu.blocker_id = new.buyer_id and bu.blocked_id = new.seller_id)
          or (bu.blocker_id = new.seller_id and bu.blocked_id = new.buyer_id)
    ) then
      raise exception 'Users are blocked from connecting';
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

create unique index if not exists idx_direct_conversations_pair
  on public.conversations (least(buyer_id, seller_id), greatest(buyer_id, seller_id))
  where ad_id is null;

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

  if new.listing_id is null and new.status = 'accepted' then
    begin
      insert into public.conversations (ad_id, buyer_id, seller_id)
      values (
        null,
        least(new.sender_id, new.recipient_id),
        greatest(new.sender_id, new.recipient_id)
      );
    exception when unique_violation then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_direct_connection_conversation on public.connection_requests;
create trigger trg_create_direct_connection_conversation
after insert or update on public.connection_requests
for each row execute function public.create_direct_connection_conversation();

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
       where cr.listing_id is null
         and cr.status = 'accepted'
         and cr.sender_id in (conv.buyer_id, conv.seller_id)
         and cr.recipient_id in (conv.buyer_id, conv.seller_id)
         and cr.sender_id <> cr.recipient_id
    ) then
      raise exception 'Accepted direct connection required';
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
