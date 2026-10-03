-- Telegram bot configuration table
-- Replaces the need for ALTER DATABASE which isn't allowed in managed Supabase

create table if not exists public.app_config (
    key text primary key,
    value text not null,
    description text,
    updated_at timestamptz not null default now()
);

-- Insert Telegram bot username (update this value if bot username changes)
insert into
    public.app_config (key, value, description)
values (
        'telegram_bot_username',
        'FindItVerifyBot',
        'Telegram bot username for verification deep links (without @)'
    ) on conflict (key) do
update
set
    value = excluded.value,
    updated_at = now();

-- RLS: Public read for bot username (non-sensitive)
alter table public.app_config enable row level security;

drop policy if exists "app_config_public_read" on public.app_config;

create policy "app_config_public_read" on public.app_config for
select using (true);

-- Only service role can modify (handled by RLS default - no insert/update/delete policies)

-- Update the create_phone_verification_session function to use config table
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
  v_uid uuid := auth.uid();
  v_normalized text;
  v_token text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_deep_link text;
  v_bot_username text;
begin
  if v_uid is null then
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
  if public.is_phone_verified_by_another(v_normalized, v_uid) then
    raise exception 'This phone number is already verified with another account';
  end if;

  -- Generate cryptographically secure random token (32 bytes = 256 bits)
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Clean up any existing pending sessions for this user/phone/method
  delete from public.phone_verification_sessions
  where user_id = v_uid
    and phone = v_normalized
    and method = p_method
    and status = 'pending';

  -- Insert new session
  insert into public.phone_verification_sessions (user_id, phone, method, token, expires_at)
  values (v_uid, v_normalized, p_method, v_token, v_expires_at)
  returning id, token, expires_at
  into v_uid, v_token, v_expires_at;

  -- Generate deep link based on method
  if p_method = 'whatsapp' then
    v_deep_link := 'https://wa.me/' || current_setting('app.whatsapp_verification_number', true) || '?text=VERIFY_' || v_token;
  else
    -- Get bot username from config table
    select value into v_bot_username from public.app_config where key = 'telegram_bot_username';
    if v_bot_username is null then
      v_bot_username := 'FindItVerifyBot'; -- fallback default
    end if;
    v_deep_link := 'https://t.me/' || v_bot_username || '?start=VERIFY_' || v_token;
  end if;

  return query select v_uid as session_id, v_token, v_expires_at, v_deep_link;
end;
$$;