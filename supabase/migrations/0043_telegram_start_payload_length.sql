create or replace function public.create_phone_verification_session(
  p_phone text,
  p_method text
)
returns table (
  session_id uuid,
  token text,
  expires_at timestamptz,
  deep_link text
) language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_normalized text;
  v_token text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_deep_link text;
  v_bot_username text;
  v_whatsapp_number text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_method not in ('whatsapp', 'telegram') then
    raise exception 'Invalid verification method';
  end if;

  v_normalized := trim(p_phone);
  v_normalized := regexp_replace(v_normalized, '[\s\-\(\)]', '', 'g');
  if v_normalized ~ '^[6-9][0-9]{9}$' then
    v_normalized := '+91' || v_normalized;
  elsif v_normalized ~ '^91[6-9][0-9]{9}$' then
    v_normalized := '+' || v_normalized;
  end if;

  if v_normalized !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Invalid Indian phone number';
  end if;

  perform public.check_verification_rate_limit(v_user_id, v_normalized, p_method);

  if public.is_phone_verified_by_another(v_normalized, v_user_id) then
    raise exception 'This phone number is already verified with another account';
  end if;

  v_token := encode(gen_random_bytes(28), 'hex');

  delete from public.phone_verification_sessions
  where user_id = v_user_id
    and phone = v_normalized
    and method = p_method
    and status = 'pending';

  insert into public.phone_verification_sessions (user_id, phone, method, token, expires_at)
  values (v_user_id, v_normalized, p_method, v_token, v_expires_at)
  returning id into v_session_id;

  if p_method = 'whatsapp' then
    select value into v_whatsapp_number
    from public.app_config
    where key = 'whatsapp_verification_number';
    if v_whatsapp_number is null then
      raise exception 'WhatsApp verification number not configured';
    end if;
    v_deep_link := 'https://wa.me/' || v_whatsapp_number || '?text=VERIFY_' || v_token;
  else
    select value into v_bot_username
    from public.app_config
    where key = 'telegram_bot_username';
    if v_bot_username is null then
      v_bot_username := 'FindItVerificationBot';
    end if;
    v_deep_link := 'https://t.me/' || v_bot_username || '?start=VERIFY_' || v_token;
  end if;

  return query select v_session_id, v_token, v_expires_at, v_deep_link;
end;
$$;