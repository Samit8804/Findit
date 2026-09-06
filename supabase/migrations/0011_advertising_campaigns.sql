-- Advertising campaigns — real persistence for /admin/advertising
create table if not exists public.advertising_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser text not null,
  banner_text text not null,
  destination text not null,
  placement text not null check (placement in ('Homepage','Category','Location','Listing','Business')),
  start_date date not null,
  end_date date not null,
  price numeric(12,2) not null check (price >= 0),
  status text not null default 'Scheduled' check (status in ('Active','Scheduled','Ended')),
  impressions int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
alter table public.advertising_campaigns enable row level security;
drop policy if exists "campaigns_admin_all" on public.advertising_campaigns;
create policy "campaigns_admin_all" on public.advertising_campaigns for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "campaigns_public_none" on public.advertising_campaigns;
-- no public read; admin only
create index if not exists idx_campaigns_status on public.advertising_campaigns(status);
create index if not exists idx_campaigns_placement on public.advertising_campaigns(placement);
