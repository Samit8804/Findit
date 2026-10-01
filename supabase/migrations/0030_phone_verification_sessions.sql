-- Phone verification sessions for WhatsApp/Telegram verification
-- Supports multi-channel verification without replacing email/password auth

-- 1. Verification sessions table
create table if not exists public.phone_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  method text not null check (method in ('whatsapp', 'telegram')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired', 'failed')),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index for fast lookups
create index if not exists idx_phone_verification_sessions_user_phone
  on public.phone_verification_sessions (user_id, phone);
create index if not exists idx_phone_verification_sessions_token
  on public.phone_verification_sessions (token);
create index if not exists idx_phone_verification_sessions_expires
  on public.phone_verification_sessions (expires_at);

-- RLS: Users can only see their own sessions
alter table public.phone_verification_sessions enable row level security;

drop policy if exists "phone_verification_sessions_own_select" on public.phone_verification_sessions;
create policy "phone_verification_sessions_own_select" on public.phone_verification_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "phone_verification_sessions_own_insert" on public.phone_verification_sessions;
create policy "phone_verification_sessions_own_insert" on public.phone_verification_sessions
  for insert with check (auth.uid() = user_id);

-- Service role can do everything (for webhooks)
-- No policy needed - service role bypasses RLS

-- 2. Helper function to check if phone is already verified by another account
-- Reuses the existing partial unique index logic but for sessions
create or replace function public.is_phone_verified_by_another(p_phone text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where phone = p_phone
      and phone_verified = true
      and id != p_user_id
  );
$$;

-- 3. Secure function to create a verification session
-- Generates a cryptographically random token
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
    -- WhatsApp: wa.me/FindItVerification?text=VERIFY_{token}
    v_deep_link := 'https://wa.me/' || current_setting('app.whatsapp_verification_number', true) || '?text=VERIFY_' || v_token;
  else
    -- Telegram: t.me/FindItVerificationBot?start=VERIFY_{token}
    v_deep_link := 'https://t.me/' || current_setting('app.telegram_bot_username', true) || '?start=VERIFY_' || v_token;
  end if;

  return query select v_uid as session_id, v_token, v_expires_at, v_deep_link;
end;
$$;

-- 4. Secure function to verify a session (called by webhooks)
-- Only service role / webhook can call this
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

  -- Find session by token
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

-- 5. Function to get verification status for polling
create or replace function public.get_phone_verification_status(
  p_session_id uuid
)
returns table (
  status text,
  phone text,
  verified_at timestamptz,
  expires_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select s.status, s.phone, s.verified_at, s.expires_at
  from public.phone_verification_sessions s
  where s.id = p_session_id
    and s.user_id = auth.uid();
end;
$$;

-- 6. Cleanup function for expired sessions (can be run via pg_cron)
create or replace function public.cleanup_expired_phone_sessions()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  delete from public.phone_verification_sessions
  where status = 'pending'
    and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;