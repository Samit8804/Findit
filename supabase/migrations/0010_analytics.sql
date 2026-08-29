-- ============================================================
-- FindIt — Analytics System
-- Run AFTER 0009. Idempotent.
-- ============================================================

-- ---------- CORE EVENTS ----------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'page_view','search','ad_view','ad_favorite','ad_unfavorite',
    'seller_profile_view','business_profile_view',
    'message_started','message_sent',
    'ad_created','ad_updated','ad_submitted','ad_approved','ad_rejected','ad_sold','ad_reported',
    'user_registered','user_login',
    'promotion_viewed','promotion_selected','checkout_started','payment_success','payment_failed','promotion_activated'
  )),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_analytics_event on public.analytics_events(event_name);
create index if not exists idx_analytics_created on public.analytics_events(created_at desc);
create index if not exists idx_analytics_entity on public.analytics_events(entity_type, entity_id);
create index if not exists idx_analytics_user on public.analytics_events(user_id);

-- ---------- SEARCH ANALYTICS ----------
create table if not exists public.search_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  query text,
  category_id uuid references public.categories(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  filters jsonb not null default '{}'::jsonb,
  result_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_search_created on public.search_analytics(created_at desc);
create index if not exists idx_search_category on public.search_analytics(category_id);
create index if not exists idx_search_location on public.search_analytics(location_id);

-- ---------- DAILY AD STATS (aggregation) ----------
create table if not exists public.daily_ad_stats (
  date date not null,
  ad_id uuid not null references public.ads(id) on delete cascade,
  views int not null default 0,
  favorites int not null default 0,
  messages int not null default 0,
  primary key (date, ad_id)
);
create index if not exists idx_daily_ad_date on public.daily_ad_stats(date desc);

-- ---------- RLS ----------
alter table public.analytics_events enable row level security;
alter table public.search_analytics enable row level security;
alter table public.daily_ad_stats enable row level security;

-- Analytics: inserts allowed for authenticated or anon (session-based), reads admin-only
drop policy if exists "analytics_insert_any" on public.analytics_events;
create policy "analytics_insert_any" on public.analytics_events for insert with check (true);
drop policy if exists "analytics_admin_read" on public.analytics_events;
create policy "analytics_admin_read" on public.analytics_events for select using (public.is_admin() or auth.uid() = user_id);

drop policy if exists "search_insert_any" on public.search_analytics;
create policy "search_insert_any" on public.search_analytics for insert with check (true);
drop policy if exists "search_admin_read" on public.search_analytics;
create policy "search_admin_read" on public.search_analytics for select using (public.is_admin());

drop policy if exists "daily_stats_admin" on public.daily_ad_stats;
create policy "daily_stats_admin" on public.daily_ad_stats for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "daily_stats_owner_read" on public.daily_ad_stats;
create policy "daily_stats_owner_read" on public.daily_ad_stats for select using (
  exists (select 1 from public.ads a where a.id = ad_id and a.user_id = auth.uid())
);

-- ---------- RETENTION CLEANUP HELPER ----------
create or replace function public.cleanup_old_analytics(retention_days int default 90)
returns void language sql security definer set search_path = public as $$
  delete from public.analytics_events where created_at < now() - (retention_days || ' days')::interval;
  delete from public.search_analytics where created_at < now() - (retention_days || ' days')::interval;
$$;
