import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

export interface Promotion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: 'featured' | 'top' | 'boost' | 'extension' | 'business_subscription';
  price: number;
  currency: string;
  durationDays: number | null;
  planType?: string | null;
  messagingAccess: boolean;
}

type PromotionType = Promotion['type'];

interface PromotionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: PromotionType;
  price: number | string;
  currency: string;
  duration_days: number | null;
  plan_type: string | null;
  messaging_access?: boolean | null;
}

function mapPromotion(p: PromotionRow): Promotion {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description ?? '',
    type: p.type,
    price: Number(p.price),
    currency: p.currency,
    durationDays: p.duration_days,
    planType: p.plan_type ?? undefined,
    messagingAccess: p.messaging_access === true,
  };
}

export interface PlanEligibility {
  eligible: boolean;
  reason: string;
  message: string;
  benefitKind?: string;
  planType?: string;
  durationDays?: number;
  currentExpiry?: string;
  targetExpiry?: string;
  remainingDays?: number;
}

export async function getActivePromotions(): Promise<Promotion[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data, error } = await sb
    .from('promotions')
    .select('id, name, slug, description, type, price, currency, duration_days, plan_type, messaging_access')
    .eq('is_active', true)
    .order('price');

  if (error || !data) return [];
  return data.map((p) => mapPromotion(p));
}

/* ---------------- Plan Eligibility ---------------- */

export async function getAdPlanEligibility(
  adId: string | null,
  promotionId: string,
): Promise<PlanEligibility> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  const { data, error } = await sb.rpc('get_ad_plan_eligibility', {
    p_ad_id: adId,
    p_promotion_id: promotionId,
  });
  if (error) throw new Error(error.message);
  return data as PlanEligibility;
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
  benefitResult?: {
    applied?: boolean;
    skipped?: string[];
  } | null;
  benefitFailure?: { reason?: string; message?: string } | null;
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
  if (!sb) throw new Error('Supabase not configured');
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
    adTitle: o.ads?.title ?? '—',
    productName: o.promotions?.name ?? '—',
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
  if (!sb) throw new Error('Supabase not configured');
  let q = sb
    .from('orders')
    .select(`id, amount, provider, status, created_at, user_id,
             promotions(name), ads(title)`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'All') q = q.eq('status', status.toLowerCase());

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data || []) as any[];
  const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
  let profileMap = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: profs } = await sb.from('profiles').select('id, email, name').in('id', userIds);
    if (profs) profs.forEach((p: any) => profileMap.set(p.id, p));
  }
  return rows.map((o: any) => {
    const prof = profileMap.get(o.user_id);
    return {
      id: o.id,
      user_email: prof?.email ?? prof?.name ?? null,
      adTitle: o.ads?.title ?? '—',
      productName: o.promotions?.name ?? '—',
      amount: Number(o.amount ?? 0),
      provider: o.provider,
      status: o.status,
      date: new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
  });
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
  plan_type: string | null;
  price: number;
  currency: string;
  duration_days: number | null;
  is_active: boolean;
  messaging_access: boolean;
}

export async function adminListPromotions(): Promise<AdminPromotion[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data, error } = await sb
    .from('promotions')
    .select('id, name, slug, description, type, plan_type, price, currency, duration_days, is_active, messaging_access')
    .order('price');

  if (error) throw new Error(error.message);
  return (data || []).map((p) => ({
    ...p,
    price: Number(p.price),
    messaging_access: p.messaging_access === true,
  })) as AdminPromotion[];
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
