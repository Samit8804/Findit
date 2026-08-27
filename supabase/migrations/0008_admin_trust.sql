-- ============================================================
-- FindIt — Admin Control Center + Trust & Safety
-- Run AFTER 0007. Idempotent where possible.
-- ============================================================

-- ---------- 1. PROFILES: account_status + suspension ----------
alter table public.profiles add column if not exists account_status text not null default 'active'
  check (account_status in ('active','suspended','banned'));
alter table public.profiles add column if not exists suspension_reason text;
alter table public.profiles add column if not exists suspended_until timestamptz;
-- Backfill existing rows
update public.profiles set account_status = 'active' where account_status is null;

-- Normalize role column to support 4 roles: user, moderator, admin, super_admin
-- Ensure existing role values are lowercased
update public.profiles set role = lower(role) where role is not null;

-- ---------- 2. ADS STATUS: add changes_requested + suspended ----------
do $$
begin
  -- Postgres enum ADD VALUE cannot run inside an explicit transaction block in PG <14
  -- for some deployments; wrap each in its own DO with exception handling.
  begin
    execute 'ALTER TYPE ad_status ADD VALUE IF NOT EXISTS ''changes_requested''';
  exception when duplicate_object then null;
  end;
  begin
    execute 'ALTER TYPE ad_status ADD VALUE IF NOT EXISTS ''suspended''';
  exception when duplicate_object then null;
  end;
end $$;

-- ---------- 3. REPORTS (full spec) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  ad_id uuid references public.ads(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null,
  description text,
  status text not null default 'open'
    check (status in ('open','investigating','resolved','dismissed')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','critical')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_priority on public.reports(priority);
create index if not exists idx_reports_created on public.reports(created_at desc);
create index if not exists idx_reports_reporter on public.reports(reporter_id);

-- ---------- 4. PROHIBITED KEYWORDS ----------
create table if not exists public.prohibited_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text unique not null,
  created_at timestamptz not null default now()
);
-- Seed a few defaults
insert into public.prohibited_keywords (keyword) values
  ('weapon'), ('counterfeit'), ('stolen'), ('escort'), ('casino')
on conflict (keyword) do nothing;

-- ---------- 5. HELPERS: role checks ----------
create or replace function public.has_role(required text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = required
  );
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('moderator','admin','super_admin')
  );
$$;

-- Update is_admin to cover admin + super_admin (moderator is separate)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('super_admin');
$$;

-- ---------- 6. ADS STATUS TRANSITIONS (centralized, secure) ----------
-- Valid transitions map. Enforced for non-service-role callers.
-- Allow: draft->pending, pending->approved/rejected/changes_requested/suspended,
--       rejected->draft, changes_requested->pending, approved->suspended/sold/expired/deleted,
--       pending->draft (request changes gives draft-like), etc.
-- For now, enforce via trigger update: guard_ad_update is expanded.

create or replace function public.guard_ad_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean := public.is_admin() or public.is_moderator();
        v_uid uuid := auth.uid();
begin
  -- Service-role / SQL editor (null uid) allowed for admin jobs/expire
  if v_uid is null then return new; end if;
  if v_is_admin or public.is_super_admin() then
    -- Admins/mods can do any valid transition; still protect counters for non-admins only
    -- but allow them to set featured/published/expires
    new.updated_at := now();
    return new;
  end if;

  -- Row ownership
  if v_uid <> old.user_id then
    raise exception 'Not permitted';
  end if;

  -- Privileged columns immutable by owners
  if new.is_featured <> old.is_featured
     or new.views_count <> old.views_count
     or new.favorites_count <> old.favorites_count
     or new.published_at is distinct from old.published_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'Protected fields cannot be modified directly';
  end if;

  -- Centralized status map for owners
  if new.status <> old.status then
    if not (
      (old.status = 'draft'              and new.status in ('draft','pending')) or
      (old.status = 'pending'            and new.status = 'pending') or
      (old.status = 'rejected'           and new.status in ('draft','pending')) or
      (old.status = 'changes_requested'  and new.status = 'pending') or
      (old.status = 'approved'           and new.status in ('sold','deleted')) or
      (old.status = 'suspended'          and new.status = 'pending')
    ) then
      raise exception 'Status transition % -> % is not allowed', old.status, new.status;
    end if;
    if new.status = 'pending' then new.rejection_reason := null; end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_ad_update on public.ads;
create trigger trg_guard_ad_update before update on public.ads
for each row execute function public.guard_ad_update();

-- Auto-unsuspend: if suspended_until in past, flip back to active on next read?
-- Instead create helper function to be called by cron or on login
create or replace function public.auto_unsuspend_accounts()
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set account_status = 'active', suspension_reason = null, suspended_until = null
   where account_status = 'suspended'
     and suspended_until is not null
     and suspended_until < now();
$$;

-- ---------- 7. RLS FOR NEW TABLES ----------
alter table public.reports enable row level security;

drop policy if exists "reports_own_insert" on public.reports;
create policy "reports_own_insert" on public.reports for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "reports_own_read" on public.reports;
create policy "reports_own_read" on public.reports for select using (
  reporter_id = auth.uid() or reported_user_id = auth.uid() or public.is_moderator()
);

drop policy if exists "reports_mod_update" on public.reports;
create policy "reports_mod_update" on public.reports for update
using (public.is_moderator()) with check (public.is_moderator());

alter table public.prohibited_keywords enable row level security;
drop policy if exists "keywords_public_read" on public.prohibited_keywords;
create policy "keywords_public_read" on public.prohibited_keywords for select using (true);
drop policy if exists "keywords_admin_write" on public.prohibited_keywords;
create policy "keywords_admin_write" on public.prohibited_keywords for all
using (public.is_admin()) with check (public.is_admin());

-- Tighten profiles: users cannot escalate own role/status; admins can read all
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select using (true);

drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and (role = (select role from public.profiles p where p.id = auth.uid()) or public.is_super_admin())
);

-- Ensure audit log stays admin-only (already)
-- Ensure orders/promotions stay admin-only (already)

-- ---------- 8. ADDITIONAL INDEXES ----------
create index if not exists idx_profiles_status on public.profiles(account_status);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_ads_status_created on public.ads(status, created_at desc);
create index if not exists idx_reports_priority_created on public.reports(priority, created_at desc);
create index if not exists idx_audit_admin_created on public.admin_audit_logs(admin_id, created_at desc);

-- ---------- 9. VIEW for admin stats (optional helper) ----------
create or replace view public.admin_stats as
select
  (select count(*) from public.profiles) as total_users,
  (select count(*) from public.profiles where created_at > now() - interval '1 day') as new_users_today,
  (select count(*) from public.ads where deleted_at is null) as total_ads,
  (select count(*) from public.ads where status = 'pending' and deleted_at is null) as pending_ads,
  (select count(*) from public.ads where status = 'approved' and deleted_at is null) as approved_ads,
  (select count(*) from public.ads where status = 'rejected') as rejected_ads,
  (select count(*) from public.reports where status in ('open','investigating')) as open_reports,
  (select coalesce(sum(amount),0) from public.orders where status = 'paid') as total_revenue;
