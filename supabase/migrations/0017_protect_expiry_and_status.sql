-- Protect expires_at and status from direct manipulation

create or replace function public.guard_ad_expiry_and_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only moderators/admins can set approved/suspended/rejected directly
  -- Users can only set draft<->pending, rejected->pending, etc. (handled by guard_ad_update)
  -- Here we specifically protect expires_at
  if not public.is_moderator() and new.expires_at is distinct from old.expires_at then
    -- Allow setting expires_at only on insert pending/approved (7d) or via renew which goes to pending
    -- For existing ads, only allow expires_at to be set if status is changing to pending (renew) and new expires_at is ~7d from now
    if TG_OP = 'INSERT' and new.status in ('pending','approved') then
      -- Allow 7d +/- 1 hour
      if new.expires_at < now() + interval '6 days' or new.expires_at > now() + interval '8 days' then
        raise exception 'Invalid expires_at for free ad';
      end if;
    elsif TG_OP = 'UPDATE' and old.status = 'draft' and new.status = 'pending' then
      if new.expires_at < now() + interval '6 days' or new.expires_at > now() + interval '8 days' then
        raise exception 'Invalid expires_at';
      end if;
    elsif TG_OP = 'UPDATE' and old.status = 'expired' and new.status = 'pending' then
      -- Renewal via paid flow should set 30d, but free renewal is not allowed without payment
      -- For now, only allow renewal via paid promotion (which sets ad_promotions), not direct expires_at
      -- So block direct expires_at change for expired->pending
      raise exception 'Renewal must go through paid promotion';
    else
      -- Any other direct expires_at change is blocked
      new.expires_at := old.expires_at;
    end if;
  end if;

  -- Prevent users from directly setting approved/suspended
  if not public.is_moderator() and new.status = 'approved' and old.status != 'approved' then
    -- Only allow pending->approved via admin, not user
    if old.status != 'pending' or new.status != 'pending' then
      -- Actually users should not be able to set approved at all
      raise exception 'Only moderators can approve';
    end if;
  end if;

  return new;
end;
$$;

-- Note: This is defense in depth; guard_ad_update already handles most status transitions
-- We keep this as additional protection for expires_at
drop trigger if exists trg_guard_expiry on public.ads;
create trigger trg_guard_expiry before update of expires_at, status on public.ads
for each row execute function public.guard_ad_expiry_and_status();
