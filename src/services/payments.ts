import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

export interface Promotion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: 'featured' | 'top' | 'boost' | 'business_subscription';
  price: number;
  currency: string;
  durationDays: number | null;
}

const FALLBACK_PROMOTIONS: Promotion[] = [
  { id: 'boost', name: 'Boost', slug: 'boost', description: 'Small visibility bump at the top of your category.', type: 'boost', price: 49, currency: 'INR', durationDays: 3 },
  { id: 'featured-ad', name: 'Featured Ad', slug: 'featured-ad', description: 'Featured badge + priority search placement.', type: 'featured', price: 99, currency: 'INR', durationDays: 7 },
  { id: 'top-listing', name: 'Top Listing', slug: 'top-listing', description: 'Homepage spotlight, TOP badge, highest ranking.', type: 'top', price: 199, currency: 'INR', durationDays: 30 },
];

export async function getActivePromotions(): Promise<Promotion[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return FALLBACK_PROMOTIONS;
  try {
    const { data, error } = await sb
      .from('promotions')
      .select('id, name, slug, description, type, price, currency, duration_days')
      .eq('is_active', true)
      .order('price');
    if (error || !data || data.length === 0) return FALLBACK_PROMOTIONS;
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      type: p.type,
      price: Number(p.price),
      currency: p.currency,
      durationDays: p.duration_days,
    }));
  } catch {
    return FALLBACK_PROMOTIONS;
  }
}

/* ---------------- Orders ---------------- */

export interface OrderStatus {
  id: string;
  amount: number;
  currency: string;
  status: 'created' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  failureReason?: string | null;
  createdAt?: string;
  paidAt?: string | null;
  promotionName?: string | null;
  promotionDays?: number | null;
  adTitle?: string | null;
  adSlug?: string | null;
}

export async function getAccessToken(): Promise<string | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const token = await getAccessToken();
  if (!token || !isSupabaseConfigured) return null;
  const res = await fetch(`/api/payments/order/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

/* ---------------- My payment history ---------------- */

export interface PaymentHistoryRow {
  id: string;
  orderId: string; // short display
  adTitle: string;
  productName: string;
  amount: number;
  status: string;
  date: string;
}

export async function getMyPaymentHistory(): Promise<PaymentHistoryRow[]> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    const { adminPayments } = await import('@/data/adminData2');
    return adminPayments.map((p) => ({
      id: p.orderId,
      orderId: p.orderId,
      adTitle: p.advertisement,
      productName: p.user ?? p.advertisement,
      amount: p.amount,
      status: p.status === 'Success' ? 'paid' : p.status.toLowerCase(),
      date: p.date,
    }));
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await sb
    .from('orders')
    .select(`id, amount, status, created_at, promotions(name), ads(title)`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map((o: any) => ({
    id: o.id,
    orderId: o.id.slice(0, 8).toUpperCase(),
    adTitle: o.ads?.title ?? 'â€”',
    productName: o.promotions?.name ?? 'â€”',
    amount: Number(o.amount ?? 0),
    status: o.status,
    date: new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  }));
}

/* ---------------- ADMIN ---------------- */

export interface AdminOrderRow {
  id: string;
  user_email: string | null;
  adTitle: string;
  productName: string;
  amount: number;
  provider: string;
  status: string;
  date: string;
}

export async function adminGetOrders(status?: string): Promise<AdminOrderRow[]> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    const { adminPayments } = await import('@/data/adminData2');
    return adminPayments.map((p) => ({
      id: p.orderId, user_email: p.user, adTitle: p.advertisement,
      productName: p.advertisement ?? '', amount: p.amount,
      provider: p.method, status: p.status.toLowerCase(), date: p.date,
    }));
  }
  let q = sb
    .from('orders')
    .select(`id, amount, provider, status, created_at, user_id,
             promotions(name), ads(title),
             profiles:user_id(email, name)`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'All') q = q.eq('status', status.toLowerCase());

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((o: any) => ({
    id: o.id,
    user_email: o.profiles?.email ?? o.profiles?.name ?? null,
    adTitle: o.ads?.title ?? '—',
    productName: o.promotions?.name ?? '—',
    amount: Number(o.amount ?? 0),
    provider: o.provider,
    status: o.status,
    date: new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  }));
}

export interface RevenueStats {
  today: number; week: number; month: number; total: number;
  paidCount: number; failedCount: number; refundedCount: number;
}

export async function getRevenueStats(): Promise<RevenueStats | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data, error } = await sb.rpc('revenue_stats');
  if (error || !data || !(data as any)[0]) return null;
  const s = (data as any)[0];
  return {
    today: Number(s.today), week: Number(s.this_week), month: Number(s.this_month),
    total: Number(s.total), paidCount: Number(s.paid_count),
    failedCount: Number(s.failed_count), refundedCount: Number(s.refunded_count),
  };
}

/* ---------------- Promotion admin CRUD ---------------- */

export interface AdminPromotion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  price: number;
  duration_days: number | null;
  is_active: boolean;
}

export async function adminListPromotions(): Promise<AdminPromotion[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data, error } = await sb
    .from('promotions')
    .select('id, name, slug, description, type, price, duration_days, is_active')
    .order('price');
  if (error) throw new Error(error.message);
  return data as AdminPromotion[];
}

export async function adminUpsertPromotion(p: Partial<AdminPromotion> & { name: string; slug: string; type: string }): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  const { error } = await sb.from('promotions').upsert({ ...p, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function adminTogglePromotion(id: string, isActive: boolean): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  const { error } = await sb.from('promotions').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}
