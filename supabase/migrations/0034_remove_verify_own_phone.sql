-- Remove the old verify_own_phone() function - it's a bypass
-- The new verify_phone_session() replaces it and is locked to service_role
drop function if exists public.verify_own_phone(text);

-- Also remove the bypass config setting since it's no longer needed
-- The guard trigger no longer needs bypass for phone verification
-- (phone verification now only happens via verify_phone_session RPC)

-- Update the guard trigger to remove the bypass logic for phone fields
create or replace function public.guard_profile_verified_v2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then
    if new.role is distinct from old.role or
       new.account_status is distinct from old.account_status or
       new.email_verified is distinct from old.email_verified or
       new.business_verified is distinct from old.business_verified then
      new.role := old.role;
      new.account_status := old.account_status;
      new.email_verified := old.email_verified;
      new.business_verified := old.business_verified;
    end if;
    -- Block direct phone_verified manipulation - only via verify_phone_session() RPC
    if new.phone_verified is distinct from old.phone_verified or
       new.phone_verified_at is distinct from old.phone_verified_at then
      new.phone_verified := old.phone_verified;
      new.phone_verified_at := old.phone_verified_at;
      if new.phone_verified = true and old.phone_verified = false then
        new.phone := old.phone;
      end if;
    end if;
    if old.phone_verified = true and new.phone is distinct from old.phone then
      new.phone := old.phone;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_verified_v2 on public.profiles;
create trigger trg_guard_profile_verified_v2 before update on public.profiles
for each row execute function public.guard_profile_verified_v2();