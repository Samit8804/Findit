-- ============================================================
-- FindIt — Seller & Business Profiles, Reputation, Verification
-- Run AFTER 0008. Idempotent.
-- ============================================================

-- Ensure role helpers exist (no-op if 0008 already ran)
create or replace function public.has_role(required text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = required);
$$;
create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderator','admin','super_admin'));
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin'));
$$;

-- ---------- PROFILES EXTENSION ----------
alter table public.profiles add column if not exists username text unique;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists location_text text;
alter table public.profiles add column if not exists account_type text not null default 'individual' check (account_type in ('individual','business'));
alter table public.profiles add column if not exists phone_verified boolean not null default false;
alter table public.profiles add column if not exists email_verified boolean not null default false;
alter table public.profiles add column if not exists business_verified boolean not null default false;
alter table public.profiles add column if not exists privacy_phone text not null default 'private' check (privacy_phone in ('public','registered_users','private'));
alter table public.profiles add column if not exists privacy_email text not null default 'private' check (privacy_email in ('public','registered_users','private'));
alter table public.profiles add column if not exists privacy_address text not null default 'private' check (privacy_address in ('public','registered_users','private'));
alter table public.profiles add column if not exists show_recently_sold boolean not null default false;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Helpful indexes
create unique index if not exists idx_profiles_username on public.profiles(lower(username)) where username is not null;
create index if not exists idx_profiles_account_type on public.profiles(account_type);
create index if not exists idx_profiles_created_at on public.profiles(created_at desc);

-- ---------- USERNAME HELP: safe slug from display_name/email ----------
create or replace function public.generate_username(base text)
returns text language plpgsql security definer set search_path = public as $$
declare candidate text; n int := 2;
begin
  candidate := lower(regexp_replace(base, '[^a-z0-9]+', '-', 'g'));
  candidate := trim(both '-' from candidate);
  if length(candidate) < 3 then candidate := candidate || '-user'; end if;
  candidate := substring(candidate from 1 for 30);
  while exists (select 1 from public.profiles where lower(username) = candidate) loop
    candidate := substring(base from 1 for 24) || '-' || n; n := n + 1;
  end loop;
  return candidate;
end;
$$;

-- ---------- BUSINESS PROFILES ----------
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  business_slug text unique not null,
  business_logo text,
  business_description text,
  business_category text,
  business_phone text,
  business_email text,
  website text check (website is null or website ~ '^https://.*'),
  address text,
  city text,
  state text,
  postal_code text,
  business_hours jsonb,
  established_year int check (established_year between 1900 and 2100),
  verification_status text not null default 'not_requested'
    check (verification_status in ('not_requested','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_business_slug on public.business_profiles(business_slug);
create index if not exists idx_business_verification on public.business_profiles(verification_status);
create index if not exists idx_business_city on public.business_profiles(city);

-- ---------- BUSINESS VERIFICATION REQUESTS ----------
create table if not exists public.business_verification_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  rejection_reason text,
  notes text
);
create index if not exists idx_bvr_status on public.business_verification_requests(status);

-- ---------- SELLER REVIEWS (prepared architecture, gated) ----------
create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  ad_id uuid not null references public.ads(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(buyer_id, ad_id),
  check (seller_id <> buyer_id)
);
create index if not exists idx_reviews_seller on public.seller_reviews(seller_id);

-- ---------- UPDATED_AT TRIGGER FOR PROFILES & BUSINESS ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_business_updated on public.business_profiles;
create trigger trg_business_updated before update on public.business_profiles
for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.business_profiles enable row level security;
alter table public.business_verification_requests enable row level security;
alter table public.seller_reviews enable row level security;

-- Business profiles: public can read only verified with active listings? For now public read if exists; private fields filtered by app.
drop policy if exists "business_public_read" on public.business_profiles;
create policy "business_public_read" on public.business_profiles for select using (true);

drop policy if exists "business_owner_write" on public.business_profiles;
create policy "business_owner_write" on public.business_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "business_owner_update" on public.business_profiles;
create policy "business_owner_update" on public.business_profiles for update using (auth.uid() = user_id);
drop policy if exists "business_owner_delete" on public.business_profiles;
create policy "business_owner_delete" on public.business_profiles for delete using (auth.uid() = user_id);

-- Verification requests: owner can create/read own, admin can read/update
drop policy if exists "bvr_owner_insert" on public.business_verification_requests;
create policy "bvr_owner_insert" on public.business_verification_requests for insert with check (auth.uid() = user_id);
drop policy if exists "bvr_owner_read" on public.business_verification_requests;
create policy "bvr_owner_read" on public.business_verification_requests for select using (auth.uid() = user_id or public.is_moderator());
drop policy if exists "bvr_mod_update" on public.business_verification_requests;
create policy "bvr_mod_update" on public.business_verification_requests for update using (public.is_moderator());

-- Seller reviews: buyer can insert once per ad, seller can read, mod can hide
drop policy if exists "reviews_public_read" on public.seller_reviews;
create policy "reviews_public_read" on public.seller_reviews for select using (true);
drop policy if exists "reviews_buyer_insert" on public.seller_reviews;
create policy "reviews_buyer_insert" on public.seller_reviews for insert with check (auth.uid() = buyer_id);

-- Profiles: tighten username uniqueness handled by unique index; public read already true
-- Ensure users cannot set verified flags directly (guard via trigger)
create or replace function public.guard_profile_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() and (
    new.email_verified is distinct from old.email_verified or
    new.phone_verified is distinct from old.phone_verified or
    new.business_verified is distinct from old.business_verified or
    new.role is distinct from old.role or
    new.account_status is distinct from old.account_status
  ) then
    -- revert protected fields
    new.email_verified := old.email_verified;
    new.phone_verified := old.phone_verified;
    new.business_verified := old.business_verified;
    new.role := old.role;
    new.account_status := old.account_status;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_profile_verified on public.profiles;
create trigger trg_guard_profile_verified before update on public.profiles
for each row execute function public.guard_profile_verified();

-- ---------- STORAGE: business logos ----------
insert into storage.buckets (id, name, public) values ('business-logos', 'business-logos', true) on conflict (id) do nothing;
drop policy if exists "blogos_public_read" on storage.objects;
create policy "blogos_public_read" on storage.objects for select using (bucket_id = 'business-logos');
drop policy if exists "blogos_owner_write" on storage.objects;
create policy "blogos_owner_write" on storage.objects for insert to authenticated with check (bucket_id = 'business-logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "blogos_owner_update" on storage.objects;
create policy "blogos_owner_update" on storage.objects for update to authenticated using (bucket_id = 'business-logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "blogos_owner_delete" on storage.objects;
create policy "blogos_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'business-logos' and (storage.foldername(name))[1] = auth.uid()::text);