-- Secure phone verification: allow user to set own phone_verified only via RPC, not direct update
-- Fixes the guard_profile_verified trigger which was blocking even legitimate verifyPhoneOtp

-- Drop the old guard that blocked all phone_verified changes for non-moderators
drop trigger if exists trg_guard_profile_verified on public.profiles;
drop function if exists public.guard_profile_verified();

-- New guard: allow phone/phone_verified to be set only via secure path, block direct role/status escalation
create or replace function public.guard_profile_verified_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only moderators can change verification flags and role/status directly
  -- For normal users, revert these fields unless they are being set via the secure verify function
  -- The secure function will set a session variable to bypass this check
  if current_setting('app.bypass_phone_guard', true) = 'on' then
    return new;
  end if;

  if not public.is_moderator() then
    -- Block role/status escalation
    if new.role is distinct from old.role or
       new.account_status is distinct from old.account_status or
       new.email_verified is distinct from old.email_verified or
       new.business_verified is distinct from old.business_verified then
      new.role := old.role;
      new.account_status := old.account_status;
      new.email_verified := old.email_verified;
      new.business_verified := old.business_verified;
    end if;
    -- Block direct phone_verified manipulation - must go through verify_own_phone()
    if new.phone_verified is distinct from old.phone_verified or
       new.phone_verified_at is distinct from old.phone_verified_at then
      new.phone_verified := old.phone_verified;
      new.phone_verified_at := old.phone_verified_at;
      -- Also revert phone if trying to set verified without proper flow
      if new.phone_verified = true and old.phone_verified = false then
        new.phone := old.phone;
      end if;
    end if;
    -- Block phone change if already verified (to prevent hijacking verified number)
    if old.phone_verified = true and new.phone is distinct from old.phone then
      new.phone := old.phone;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_verified_v2 before update on public.profiles
for each row execute function public.guard_profile_verified_v2();

-- Secure function to verify own phone after OTP
create or replace function public.verify_own_phone(p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_normalized text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  
  -- Normalize: expect +91XXXXXXXXXX, but also handle 10-digit
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

  -- Check duplicate verified (partial index will also enforce, but check with lock)
  if exists(select 1 from public.profiles where phone = v_normalized and phone_verified = true and id != v_uid) then
    raise exception 'Phone already verified with another account';
  end if;

  -- Set bypass flag and update
  perform set_config('app.bypass_phone_guard', 'on', true);
  update public.profiles set phone = v_normalized, phone_verified = true, phone_verified_at = now() where id = v_uid;
  perform set_config('app.bypass_phone_guard', 'off', true);
end;
$$;

-- Tighten profiles RLS: ensure users can only update safe fields via USING/WITH CHECK
-- Keep existing public read, but make update more restrictive
drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  -- Only allow safe fields to be changed via direct update; verified fields are blocked by trigger anyway
  -- This check ensures role/status cannot be changed
  and (role = (select role from public.profiles p where p.id = auth.uid()) or public.is_super_admin())
);
