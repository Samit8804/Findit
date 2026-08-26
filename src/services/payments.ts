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
      productName: p.advertisement,
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
