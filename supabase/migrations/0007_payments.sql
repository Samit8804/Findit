-- ============================================================
-- FindIt — Payments, promotions & ad_promotions
-- Run AFTER 0001-0006. Idempotent.
-- ============================================================

-- ---------- PROMOTIONS (products) ----------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  type text not null check (type in ('featured','top','boost','business_subscription')),
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'INR',
  duration_days int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promotions enable row level security;
drop policy if exists "promotions_public_read" on public.promotions;
create policy "promotions_public_read" on public.promotions for select using (is_active or public.is_admin());
drop policy if exists "promotions_admin_all" on public.promotions;
create policy "promotions_admin_all" on public.promotions for all using (public.is_admin()) with check (public.is_admin());

-- ---------- ORDERS ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ad_id uuid references public.ads(id) on delete set null,
  promotion_id uuid references public.promotions(id),
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  subtotal numeric(12,2),
  tax_amount numeric(12,2),
  total_amount numeric(12,2),
  tax_id text,
  provider text not null default 'razorpay',
  provider_order_id text unique,
  provider_payment_id text unique,
  provider_signature text,
  status text not null default 'created'
    check (status in ('created','pending','paid','failed','cancelled','refunded','partially_refunded')),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_orders_user on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_provider_order on public.orders(provider_order_id);

alter table public.orders enable row level security;
drop policy if exists "orders_own_read" on public.orders;
create policy "orders_own_read" on public.orders for select using (auth.uid() = user_id or public.is_admin());
-- Writes happen ONLY through the server (service-role key). No client policies.

-- ---------- PAYMENT TRANSACTIONS ----------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_transaction_id text not null,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  status text not null,
  raw_reference jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_transaction_id)
);

alter table public.payment_transactions enable row level security;
drop policy if exists "tx_own_read" on public.payment_transactions;
create policy "tx_own_read" on public.payment_transactions for select
using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- ---------- AD PROMOTIONS ----------
create table if not exists public.ad_promotions (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete cascade,
  promotion_id uuid not null references public.promotions(id),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','active','expired','cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ad_promos_ad on public.ad_promotions(ad_id);
create index if not exists idx_ad_promos_active on public.ad_promotions(status, ends_at);

alter table public.ad_promotions enable row level security;
drop policy if exists "adp_public_read" on public.ad_promotions;
create policy "adp_public_read" on public.ad_promotions for select using (true);
-- Writes only via server (service-role)

-- ---------- BUSINESS SUBSCRIPTIONS (future-proofing) ----------
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promotion_id uuid references public.promotions(id),
  order_id uuid references public.orders(id),
  plan text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;
drop policy if exists "subs_own_read" on public.user_subscriptions;
create policy "subs_own_read" on public.user_subscriptions for select using (auth.uid() = user_id);

-- ---------- SEED PROMOTION PRODUCTS ----------
insert into public.promotions (name, slug, description, type, price, duration_days)
values
  ('Boost', 'boost', 'Small visibility bump at the top of your category.', 'boost', 49, 3),
  ('Featured Ad', 'featured-ad', 'Featured badge + priority search placement.', 'featured', 99, 7),
  ('Top Listing', 'top-listing', 'Homepage spotlight, TOP badge, highest ranking.', 'top', 199, 30),
  ('Business Basic', 'business-basic', 'Directory profile, verified badge, 10 featured ads/mo.', 'business_subscription', 499, 30),
  ('Business Pro', 'business-pro', 'Unlimited featured ads, banner rotation, analytics.', 'business_subscription', 999, 30)
on conflict (slug) do nothing;

-- ============================================================
-- ATOMIC PAID-ORDER COMPLETION (webhook + verify both call this)
-- Idempotent: only transitions created/pending -> paid once.
-- ============================================================
create or replace function public.complete_paid_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_provider text default 'razorpay',
  p_amount numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ord record;
  promo record;
  activated boolean := false;
begin
  -- Lock the order row; transition once
  update public.orders
     set status = 'paid',
         paid_at = now(),
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         updated_at = now()
   where id = p_order_id
     and status in ('created','pending')
     and (p_amount is null or amount = p_amount)
  returning * into ord;

  if ord.id is null then
    return false; -- already processed or mismatched amount
  end if;

  -- Transaction record (unique constraint keeps webhooks idempotent)
  if p_provider_payment_id is not null then
    insert into public.payment_transactions (order_id, provider, provider_transaction_id, amount, currency, status)
    values (ord.id, p_provider, p_provider_payment_id, ord.amount, ord.currency, 'success')
    on conflict (provider, provider_transaction_id) do nothing;
  end if;

  -- Activate what was purchased
  select * into promo from public.promotions where id = ord.promotion_id;

  if promo.type in ('featured','top','boost') and ord.ad_id is not null then
    insert into public.ad_promotions (ad_id, promotion_id, order_id, starts_at, ends_at, status)
    values (ord.ad_id, ord.promotion_id, ord.id, now(), now() + (promo.duration_days || ' days')::interval, 'active')
    on conflict (order_id) do update
      set status = 'active',
          starts_at = now(),
          ends_at = now() + (promo.duration_days || ' days')::interval;
    activated := true;

    if promo.type in ('featured','top') then
      update public.ads set is_featured = true where id = ord.ad_id;
    end if;

    perform public.notify_user(
      ord.user_id,
      'promotion_activated',
      promo.name || ' promotion is now active.',
      ord.ad_id::text,
      jsonb_build_object('ad_id', ord.ad_id, 'order_id', ord.id)
    );

    perform public.notify_user(
      ord.user_id,
      'payment_success',
      'Payment successful',
      left(promo.name || ' — ₹' || ord.amount::text, 80),
      jsonb_build_object('order_id', ord.id)
    );

  elsif promo.type = 'business_subscription' then
    insert into public.user_subscriptions (user_id, promotion_id, order_id, plan, ends_at, status)
    values (ord.user_id,
            ord.promotion_id,
            ord.id,
            case promo.slug when 'business-pro' then 'business-pro' else 'business' end,
            now() + (promo.duration_days || ' days')::interval,
            'active');

    update public.profiles
       set plan = case promo.slug when 'business-pro' then 'business-pro' else 'business' end
     where id = ord.user_id;

    activated := true;

    perform public.notify_user(
      ord.user_id,
      'payment_success',
      'Subscription activated',
      promo.name,
      jsonb_build_object('order_id', ord.id)
    );
  end if;

  return activated or true;
end;
$$;

create or replace function public.mark_order_failed(p_order_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
     set status = 'failed',
         failure_reason = left(p_reason, 200),
         updated_at = now()
   where id = p_order_id
     and status in ('created','pending');
$$;

-- ---------- PROMOTION EXPIRATION (cron-prepared) ----------
create or replace function public.expire_promotions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ad_promotions
     set status = 'expired'
   where status = 'active'
     and ends_at is not null
     and ends_at < now();

  -- Recompute ad flags from remaining active promotions
  update public.ads a
     set is_featured = exists (
       select 1
         from public.ad_promotions ap
         join public.promotions p on p.id = ap.promotion_id
        where ap.ad_id = a.id
          and ap.status = 'active'
          and p.type in ('featured','top')
          and ap.ends_at > now()
     )
   where is_featured = true;

  -- Notify expiring soon (within 24h) once
  insert into public.notifications (user_id, type, title, body)
  select a.user_id,
         'ad_expiring',
         'Your promotion expires in less than 24 hours.',
         coalesce(a.title, '')
    from public.ads a
    join public.ad_promotions ap
      on ap.ad_id = a.id
     and ap.status = 'active'
    join public.promotions p
      on p.id = ap.promotion_id
   where ap.ends_at between now() and now() + interval '24 hours'
     and not exists (
       select 1
         from public.notifications n
        where n.user_id = a.user_id
          and n.type = 'ad_expiring'
          and n.created_at > now() - interval '24 hours'
     );
end;
$$;

-- Revenue helper for admin analytics
create or replace function public.revenue_stats()
returns table(today numeric, this_week numeric, this_month numeric, total numeric,
               paid_count bigint, failed_count bigint, refunded_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where paid_at::date = current_date), 0),
    coalesce(sum(amount) filter (where paid_at >= current_date - 7), 0),
    coalesce(sum(amount) filter (where paid_at >= current_date - 30), 0),
    coalesce(sum(amount) filter (where status = 'paid'), 0),
    count(*) filter (where status = 'paid'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status in ('refunded','partially_refunded'))
  from public.orders;
$$;
