-- Add rate limiting for phone verification session creation
-- Limits: 3 attempts per user per hour, 5 per phone per hour

create table if not exists public.verification_rate_limits (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  phone text,
  method text check (method in ('whatsapp', 'telegram')),
  attempt_count int default 1,
  window_start timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_verification_rate_limits_user 
  on public.verification_rate_limits (user_id, window_start);
create index if not exists idx_verification_rate_limits_phone 
  on public.verification_rate_limits (phone, window_start);

alter table public.verification_rate_limits enable row level security;

-- Service role can manage (for cleanup)
grant all on public.verification_rate_limits to service_role;

-- Function to check and increment rate limit
create or replace function public.check_verification_rate_limit(
  p_user_id uuid,
  p_phone text,
  p_method text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hour_ago timestamptz := now() - interval '1 hour';
  v_user_count int;
  v_phone_count int;
begin
  -- Check user attempts in last hour
  select coalesce(sum(attempt_count), 0) into v_user_count
  from public.verification_rate_limits
  where user_id = p_user_id
    and window_start > v_hour_ago;

  if v_user_count >= 3 then
    raise exception 'Too many verification attempts. Please wait an hour before trying again.' using errcode = '42900';
  end if;

  -- Check phone attempts in last hour
  select coalesce(sum(attempt_count), 0) into v_phone_count
  from public.verification_rate_limits
  where phone = p_phone
    and window_start > v_hour_ago;

  if v_phone_count >= 5 then
    raise exception 'This phone number has too many verification attempts. Please wait an hour.' using errcode = '42900';
  end if;

  -- Increment or insert rate limit record
  insert into public.verification_rate_limits (user_id, phone, method, attempt_count, window_start)
  values (p_user_id, p_phone, p_method, 1, date_trunc('hour', now()))
  on conflict (user_id, phone, method, window_start) do update
    set attempt_count = verification_rate_limits.attempt_count + 1;

  return true;
end;
$$;

-- Add cleanup function for old rate limit records
create or replace function public.cleanup_verification_rate_limits()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  delete from public.verification_rate_limits
  where window_start < now() - interval '24 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;