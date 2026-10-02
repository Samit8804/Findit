-- Fix variable naming in verify_phone_session - use clear variable names
create or replace function public.verify_phone_session(
  p_token text,
  p_provider_phone text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_session public.phone_verification_sessions%rowtype;
  v_normalized_provider text;
  v_normalized_session text;
begin
  -- Normalize provider phone
  v_normalized_provider := trim(p_provider_phone);
  v_normalized_provider := regexp_replace(v_normalized_provider, '[\s\-\(\)]', '', 'g');
  if v_normalized_provider ~ '^[6-9][0-9]{9}$' then
    v_normalized_provider := '+91' || v_normalized_provider;
  elsif v_normalized_provider ~ '^91[6-9][0-9]{9}$' then
    v_normalized_provider := '+' || v_normalized_provider;
  end if;

  if v_normalized_provider !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Invalid provider phone number';
  end if;

  -- Find session by token with row lock
  select * into v_session
  from public.phone_verification_sessions
  where token = p_token
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired verification token';
  end if;

  -- Normalize session phone
  v_normalized_session := trim(v_session.phone);
  v_normalized_session := regexp_replace(v_normalized_session, '[\s\-\(\)]', '', 'g');
  if v_normalized_session ~ '^[6-9][0-9]{9}$' then
    v_normalized_session := '+91' || v_normalized_session;
  elsif v_normalized_session ~ '^91[6-9][0-9]{9}$' then
    v_normalized_session := '+' || v_normalized_session;
  end if;

  -- Verify phone numbers match
  if v_normalized_provider != v_normalized_session then
    raise exception 'Phone number mismatch';
  end if;

  -- Check duplicate verified phone again (race condition protection)
  if public.is_phone_verified_by_another(v_normalized_session, v_session.user_id) then
    raise exception 'This phone number is already verified with another account';
  end if;

  -- Mark session as verified
  update public.phone_verification_sessions
  set status = 'verified',
      verified_at = now()
  where id = v_session.id;

  -- Update profile via secure RPC (bypasses guard trigger)
  perform set_config('app.bypass_phone_guard', 'on', true);
  update public.profiles
  set phone = v_normalized_session,
      phone_verified = true,
      phone_verified_at = now()
  where id = v_session.user_id;
  perform set_config('app.bypass_phone_guard', 'off', true);
end;
$$;