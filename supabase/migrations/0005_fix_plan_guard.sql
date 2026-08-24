-- ============================================================
-- FindIt — Fix plan guard: allow dashboard SQL-editor changes
-- Run AFTER 0004. Idempotent.
-- ============================================================

create or replace function public.guard_plan_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- No JWT context = SQL editor / server-side job → allow everything
  if auth.uid() is null then return new; end if;

  -- Authenticated admins can change anything
  if public.is_admin() then return new; end if;

  -- Regular users cannot touch plan or role
  if new.plan is distinct from old.plan then
    new.plan := old.plan;
  end if;
  if new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;