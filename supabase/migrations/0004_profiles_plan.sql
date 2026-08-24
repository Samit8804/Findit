-- ============================================================
-- FindIt — Subscription plan column for messaging gating
-- Run AFTER 0001. Idempotent.
-- ============================================================

alter table public.profiles add column if not exists plan text not null default 'free';

-- Users keep editing their own profile, but the plan column itself
-- can only be changed by admins (trigger below).
create or replace function public.guard_plan_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.plan is distinct from old.plan then
    new.plan := old.plan; -- silently revert non-admin plan changes
  end if;
  if new.role is distinct from old.role then
    new.role := old.role; -- roles are admin-managed too
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile before update on public.profiles
for each row execute function public.guard_plan_change();