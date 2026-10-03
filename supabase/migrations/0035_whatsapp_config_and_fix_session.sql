-- Add WhatsApp configuration to app_config table
insert into
    public.app_config (key, value, description)
values (
        'telegram_bot_username',
        'FindItVerifyBot',
        'Telegram bot username for verification deep links (without @)'
    ),
    (
        'whatsapp_verification_number',
        '91XXXXXXXXXX',
        'WhatsApp Business number for verification (with country code, no +)'
    ) on conflict (key) do
update
set
    value = excluded.value,
    updated_at = now();

-- Update create_phone_verification_session to use app_config for both WhatsApp and Telegram
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

  -- Normalize phone number
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

  -- Check duplicate verified phone (another account already has this verified)
  if public.is_phone_verified_by_another(v_normalized, v_user_id) then
    raise exception 'This phone number is already verified with another account';
  end if;

  -- Generate cryptographically secure random token (32 bytes = 256 bits)
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Clean up any existing pending sessions for this user/phone/method
  delete from public.phone_verification_sessions
  where user_id = v_user_id
    and phone = v_normalized
    and method = p_method
    and status = 'pending';

  -- Insert new session
  insert into public.phone_verification_sessions (user_id, phone, method, token, expires_at)
  values (v_user_id, v_normalized, p_method, v_token, v_expires_at)
  returning id, token, expires_at
  into v_session_id, v_token, v_expires_at;

  -- Generate deep link based on method
  if p_method = 'whatsapp' then
    select value into v_whatsapp_number from public.app_config where key = 'whatsapp_verification_number';
    if v_whatsapp_number is null then
      raise exception 'WhatsApp verification number not configured';
    end if;
    v_deep_link := 'https://wa.me/' || v_whatsapp_number || '?text=VERIFY_' || v_token;
  else
    select value into v_bot_username from public.app_config where key = 'telegram_bot_username';
    if v_bot_username is null then
      v_bot_username := 'FindItVerifyBot';
    end if;
    v_deep_link := 'https://t.me/' || v_bot_username || '?start=VERIFY_' || v_token;
  end if;

  return query select v_session_id as session_id, v_token, v_expires_at, v_deep_link;
end;
$$;