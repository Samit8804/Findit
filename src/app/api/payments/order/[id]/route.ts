import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/order/[id]
 * Returns the VERIFIED order status. Owner or admin only.
 * The success page reads status from here — never decides itself.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdminConfigured) return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });
    const admin = getSupabaseAdmin()!;

    const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    const { data: authData } = await admin.auth.getUser(token);
    if (!authData.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

    const { id } = await ctx.params;
    const { data: order } = await admin
      .from('orders')
      .select(`id, amount, currency, status, failure_reason, created_at, paid_at,
               provider_order_id, provider_payment_id,
               promotions(name, duration_days),
               ads(title, slug),
               user_id`)      .eq('id', id)
      .single();

    if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (order.user_id !== authData.user.id && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 }); // don't leak existence
    }

    const promoRow: any = Array.isArray((order as any).promotions) ? (order as any).promotions[0] : ((order as any).promotions ?? {});
    const adRow: any = Array.isArray((order as any).ads) ? (order as any).ads[0] : ((order as any).ads ?? {});

    return NextResponse.json({
      id: order.id,
      amount: Number(order.amount ?? 0),
      currency: order.currency,
      status: order.status,
      failureReason: order.failure_reason,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      promotionName: promoRow.name ?? null,
      promotionDays: promoRow.duration_days ?? null,
      adTitle: adRow.title ?? null,
      adSlug: adRow.slug ?? null,
      // Public gateway values needed to reopen checkout if unpaid
      providerOrderId: order.provider_order_id ?? null,
      keyId: process.env.RAZORPAY_KEY_ID || null,
    });
  } catch (e: any) {
    console.error('[payments] get order error:', e.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}