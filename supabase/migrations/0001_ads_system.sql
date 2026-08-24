-- ============================================================
-- FindIt — Advertisement System Migration
-- Run in Supabase SQL Editor. Idempotent: preserves existing
-- tables/data; only adds what is missing.
-- ============================================================

-- ---------- 1. ENUMS ----------
do $$ begin
  create type ad_status as enum ('draft','pending','approved','rejected','expired','sold','deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ad_condition as enum ('new','used_like_new','used_good','used_fair');
exception when duplicate_object then null; end $$;

-- ---------- 2. CATEGORIES (skip if exists) ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text unique not null,
  icon text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 2b. PROFILES (only if missing; preserves existing) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  whatsapp text,
  avatar_url text,
  role text not null default 'user',
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists is_verified boolean default false;
alter table public.profiles add column if not exists whatsapp text;

update public.profiles set role = 'user' where role is null;
update public.profiles set is_verified = false where is_verified is null;

alter table public.profiles enable row level security;
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select using (true);
drop policy if exists "profiles_own_update" on public.profiles;
create policy "profiles_own_update" on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- 3. LOCATIONS (hierarchy) ----------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations(id) on delete cascade,
  level text not null check (level in ('country','state','city','locality')),
  name text not null,
  slug text not null,
  unique(parent_id, slug)
);
create index if not exists idx_locations_parent on public.locations(parent_id);

-- ---------- 4. ADS (alter-if-exists strategy) ----------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.categories(id),
  location_id uuid references public.locations(id),
  title text not null,
  slug text unique not null,
  description text not null,
  price numeric(14,2) check (price >= 0),
  condition ad_condition,
  attributes jsonb not null default '{}'::jsonb,
  status ad_status not null default 'draft',
  rejection_reason text,
  contact_show_phone boolean default false,
  contact_show_whatsapp boolean default false,
  contact_allow_messages boolean default true,
  views_count int not null default 0,
  favorites_count int not null default 0,
  is_featured boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add missing columns to a pre-existing ads table (preserves data)
alter table public.ads add column if not exists subcategory_id uuid references public.categories(id);
alter table public.ads add column if not exists location_id uuid references public.locations(id);
alter table public.ads add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.ads add column if not exists rejection_reason text;
alter table public.ads add column if not exists contact_show_phone boolean default false;
alter table public.ads add column if not exists contact_show_whatsapp boolean default false;
alter table public.ads add column if not exists contact_allow_messages boolean default true;
alter table public.ads add column if not exists views_count int not null default 0;
alter table public.ads add column if not exists favorites_count int not null default 0;
alter table public.ads add column if not exists is_featured boolean not null default false;
alter table public.ads add column if not exists published_at timestamptz;
alter table public.ads add column if not exists expires_at timestamptz;
alter table public.ads add column if not exists deleted_at timestamptz;
alter table public.ads add column if not exists slug text;
alter table public.ads add column if not exists condition_val ad_condition;

-- ---------- 5. AD IMAGES ----------
create table if not exists public.ad_images (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(ad_id, storage_path)
);
create index if not exists idx_ad_images_ad on public.ad_images(ad_id);

-- ---------- 6. FAVORITES ----------
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  ad_id uuid not null references public.ads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ad_id)
);

-- ---------- 7. NOTIFICATIONS ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

-- ---------- 8. ADMIN AUDIT LOG ----------
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------- 9. INDEXES (search/perf prep) ----------
create index if not exists idx_ads_status_public on public.ads(status, deleted_at, expires_at) where status = 'approved';
create index if not exists idx_ads_user on public.ads(user_id, created_at desc);
create index if not exists idx_ads_category on public.ads(category_id);
create index if not exists idx_ads_subcategory on public.ads(subcategory_id);
create index if not exists idx_ads_location on public.ads(location_id);
create index if not exists idx_ads_price on public.ads(price);
create index if not exists idx_ads_created on public.ads(created_at desc);
create index if not exists idx_favorites_ad on favorites(ad_id);

-- ============================================================
-- HELPERS: role + slug
-- ============================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'admin'
  );
$$;

create or replace function public.ensure_unique_slug(base_slug text, ad_id uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare candidate text; n int := 2;
begin
  candidate := base_slug;
  while exists (select 1 from public.ads where slug = candidate and (ad_id is null or id <> ad_id)) loop
    candidate := base_slug || '-' || n; n := n + 1;
  end loop;
  return candidate;
end;
$$;

-- ============================================================
-- TRIGGER: users can never grant themselves privileged fields.
-- Non-admins may only move their own ads between
-- draft <-> pending, and set rejected->pending (resubmit).
-- approved/featured/views/favorites/expiry are server-only.
-- ============================================================
create or replace function public.guard_ad_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean := public.is_admin(); v_uid uuid := auth.uid();
begin
  if v_is_admin then return new; end if;

  -- Row ownership
  if v_uid is null or v_uid <> old.user_id then
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

  -- Allowed status transitions for owner:
  --   draft->draft, draft->pending, pending->pending(edit), rejected->pending(resubmit)
  if new.status <> old.status then
    if not (
      (old.status = 'draft'    and new.status in ('draft','pending')) or
      (old.status = 'pending'  and new.status = 'pending') or
      (old.status = 'rejected' and new.status = 'pending')
    ) then
      raise exception 'Status transition % -> % is not allowed', old.status, new.status;
    end if;
    -- leaving rejected clears rejection state
    if new.status = 'pending' then new.rejection_reason := null; end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_ad_update on public.ads;
create trigger trg_guard_ad_update before update on public.ads
for each row execute function public.guard_ad_update();

create or replace function public.guard_ad_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if auth.uid() is null or new.user_id <> auth.uid() then
      raise exception 'Cannot create ads for another user';
    end if;
    if new.status not in ('draft','pending') then
      raise exception 'New ads must start as draft or pending';
    end if;
    if new.is_featured or new.views_count <> 0 or new.favorites_count <> 0 then
      raise exception 'Privileged fields must be default on insert';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_ad_insert on public.ads;
create trigger trg_guard_ad_insert before insert on public.ads
for each row execute function public.guard_ad_insert();

-- Auto-expire helper: marks approved ads past expiry (call via cron/pg_cron later)
create or replace function public.expire_due_ads()
returns void language sql security definer set search_path = public as $$
  update public.ads
     set status = 'expired'
   where status = 'approved'
     and expires_at is not null
     and expires_at < now();
$$;

-- Secure view counter: client can only +1, never set values
create or replace function public.increment_ad_views(p_ad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ads
     set views_count = views_count + 1
   where id = p_ad_id and status = 'approved' and deleted_at is null;
end;
$$;

-- Notification writer used by moderation flow
create or replace function public.notify_user(p_user uuid, p_type text, p_title text, p_body text default null, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, data) values (p_user, p_type, p_title, p_body, p_data);
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.ads enable row level security;
alter table public.ad_images enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select using (is_active or public.is_admin());

drop policy if exists "locations_public_read" on public.locations;
create policy "locations_public_read" on public.locations for select using (true);

-- ADS
drop policy if exists "ads_public_read" on public.ads;
create policy "ads_public_read" on public.ads for select using (
  (status = 'approved' and deleted_at is null and (expires_at is null or expires_at > now()))
  or (auth.uid() = user_id and deleted_at is null)
  or public.is_admin()
);

drop policy if exists "ads_owner_insert" on public.ads;
create policy "ads_owner_insert" on public.ads for insert with check (auth.uid() = user_id);

drop policy if exists "ads_owner_update" on public.ads;
create policy "ads_owner_update" on public.ads for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists "ads_owner_delete" on public.ads;
create policy "ads_owner_delete" on public.ads for delete using (auth.uid() = user_id or public.is_admin());

-- AD_IMAGES (ownership via join)
drop policy if exists "images_read" on public.ad_images;
create policy "images_read" on public.ad_images for select using (
  exists (select 1 from public.ads a where a.id = ad_id and ((a.status='approved' and a.deleted_at is null) or a.user_id = auth.uid() or public.is_admin()))
);
drop policy if exists "images_owner_write" on public.ad_images;
create policy "images_owner_write" on public.ad_images for insert with check (
  exists (select 1 from public.ads a where a.id = ad_id and a.user_id = auth.uid())
);
drop policy if exists "images_owner_update" on public.ad_images;
create policy "images_owner_update" on public.ad_images for update using (
  exists (select 1 from public.ads a where a.id = ad_id and (a.user_id = auth.uid() or public.is_admin()))
);
drop policy if exists "images_owner_delete" on public.ad_images;
create policy "images_owner_delete" on public.ad_images for delete using (
  exists (select 1 from public.ads a where a.id = ad_id and (a.user_id = auth.uid() or public.is_admin()))
);

-- FAVORITES (own rows only)
drop policy if exists "fav_own_select" on public.favorites;
create policy "fav_own_select" on public.favorites for select using (auth.uid() = user_id);
drop policy if exists "fav_own_insert" on public.favorites;
create policy "fav_own_insert" on public.favorites for insert with check (auth.uid() = user_id);
drop policy if exists "fav_own_delete" on public.favorites;
create policy "fav_own_delete" on public.favorites for delete using (auth.uid() = user_id);

-- NOTIFICATIONS (own rows only)
drop policy if exists "notif_own_all" on public.notifications;
create policy "notif_own_all" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AUDIT LOG: admins write, admins read
drop policy if exists "audit_admin_all" on public.admin_audit_logs;
create policy "audit_admin_all" on public.admin_audit_logs for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- STORAGE: bucket + policies (folder-scoped: uid/ad-id/*)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ad-images', 'ad-images', true)
on conflict (id) do nothing;

drop policy if exists "ad_images_insert_own_folder" on storage.objects;
create policy "ad_images_insert_own_folder" on storage.objects for insert to authenticated
with check (bucket_id = 'ad-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ad_images_select_public" on storage.objects;
create policy "ad_images_select_public" on storage.objects for select using (bucket_id = 'ad-images');

drop policy if exists "ad_images_delete_own" on storage.objects;
create policy "ad_images_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'ad-images' and (storage.foldername(name))[1] = auth.uid()::text);