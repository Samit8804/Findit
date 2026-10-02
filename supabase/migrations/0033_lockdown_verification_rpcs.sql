-- Lock down verify_phone_session - only service role (webhooks) can call
-- Revoke public execute, grant to service_role only
revoke execute on function public.verify_phone_session(text, text) from public;
grant execute on function public.verify_phone_session(text, text) to service_role;

-- Also lock down the config table - only service role can modify
revoke all on table public.app_config from public;
grant select on table public.app_config to public;
grant all on table public.app_config to service_role;

-- Lock down phone_verification_sessions - users can only read their own, service_role full access
revoke all on table public.phone_verification_sessions from public;
grant select on table public.phone_verification_sessions to authenticated;
grant all on table public.phone_verification_sessions to service_role;

-- Ensure RLS policies are correct
drop policy if exists "phone_verification_sessions_own_select" on public.phone_verification_sessions;
create policy "phone_verification_sessions_own_select" on public.phone_verification_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "phone_verification_sessions_own_insert" on public.phone_verification_sessions;
create policy "phone_verification_sessions_own_insert" on public.phone_verification_sessions
  for insert with check (auth.uid() = user_id);

-- Service role bypasses RLS automatically