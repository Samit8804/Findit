-- Enforce phone verification for ad publishing (not draft)
-- Drafts are allowed without verification; only pending/approved require verified phone

create or replace function public.check_phone_verified_for_ad()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_verified boolean;
begin
  -- Only enforce for publish statuses
  if new.status in ('pending', 'approved') then
    select phone_verified into v_verified from public.profiles where id = new.user_id;
    if v_verified is null or v_verified = false then
      raise exception 'PHONE_NOT_VERIFIED' using errcode = '45000';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_phone_verified_for_ad on public.ads;
create trigger trg_check_phone_verified_for_ad
before insert or update of status on public.ads
for each row execute function public.check_phone_verified_for_ad();

-- Also add RLS note: keep existing RLS, this trigger is defense in depth
