import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';
import { getPaymentProvider } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/create-order
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { ad_id?, promotion_slug }
 *
 * Server determines: user identity, price from DB, eligibility.
 * Never trusts amount/status/promotion data from the browser.
 */
export async function POST(req: Request) {
  try {
    if (!isAdminConfigured) {
      return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });
    }
    const admin = getSupabaseAdmin()!;

    /* 1. Authenticate */
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData.user) {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    }
    const user = authData.user;

    const body = await req.json().catch(() => null);
    const adId: string | undefined = body?.ad_id;
    const promotionSlug: string | undefined = body?.promotion_slug;

    /* 2. Verify promotion exists + active; price comes from DB */
    const { data: promo, error: promoErr } = await admin
      .from('promotions')
      .select('id, name, slug, type, price, currency, duration_days, is_active')
      .eq('slug', promotionSlug ?? '')
      .single();

    if (promoErr || !promo) {
      return NextResponse.json({ error: 'PROMOTION_NOT_FOUND' }, { status: 404 });
    }
    if (!promo.is_active) {
      return NextResponse.json({ error: 'PROMOTION_UNAVAILABLE' }, { status: 409 });
    }

    /* 3. Ad-promotions require an owned, approved ad */
    let ad: any = null;
    if (promo.type !== 'business_subscription') {
      if (!adId) return NextResponse.json({ error: 'AD_REQUIRED' }, { status: 400 });

      const { data: adRow, error: adErr } = await admin
        .from('ads')
        .select('id, user_id, title, slug, status')
        .eq('id', adId)
        .single();
      if (adErr || !adRow) return NextResponse.json({ error: 'AD_NOT_FOUND' }, { status: 404 });
      if (adRow.user_id !== user.id) {
        return NextResponse.json({ error: 'AD_NOT_OWNED' }, { status: 403 });
      }
      if (!['pending','approved'].includes(adRow.status)) {
        return NextResponse.json(
          { error: 'AD_NOT_ELIGIBLE', detail: 'Only pending or approved advertisements can be promoted. Draft must be submitted first.' },
          { status: 409 },
        );
      }
      ad = adRow;
    }

    /* 4. Create internal order (price/currency from DB only) */
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        ad_id: ad?.id ?? null,
        promotion_id: promo.id,
        amount: promo.price,
        currency: promo.currency,
        subtotal: promo.price,
        total_amount: promo.price,
        provider: 'razorpay',
        status: 'created',
        metadata: { promotion_name: promo.name, duration_days: promo.duration_days },
      })
      .select('id, amount, currency')
      .single();

    if (orderErr || !order) {
      console.error('[payments] order insert failed:', orderErr?.message);
      return NextResponse.json({ error: 'ORDER_CREATE_FAILED' }, { status: 500 });
    }

    /* 5. Gateway order */
    const provider = getPaymentProvider();
    let gatewayOrder: any;
    try {
      gatewayOrder = await provider.createOrder({
        internalOrderId: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        description: `FindIt â€” ${promo.name}${ad ? ` (${ad.title})` : ''}`,
        customerEmail: user.email ?? undefined,
        customerName:
          (user.user_metadata?.name as string) ?? undefined,
      });
    } catch (e: any) {
      await admin
        .from('orders')
        .update({ status: 'failed', failure_reason: e.message.slice(0, 200) })
        .eq('id', order.id);
      const notConfigured = e.message === 'RAZORPAY_NOT_CONFIGURED';
      return NextResponse.json(
        {
          error: notConfigured ? 'GATEWAY_NOT_CONFIGURED' : 'GATEWAY_ERROR',
          detail: e.message,
        },
        { status: notConfigured ? 503 : 502 },
      );
    }

    /* 6. Store gateway order id */
    await admin
      .from('orders')
      .update({ provider_order_id: gatewayOrder.providerOrderId, status: 'pending' })
      .eq('id', order.id);

    /* 7. Safe response only */
    return NextResponse.json({
      orderId: order.id,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency,
      keyId: gatewayOrder.publicKeyId,
      providerOrderId: gatewayOrder.providerOrderId,
      providerName: provider.name,
      promotion: { name: promo.name, duration_days: promo.duration_days },
      ad: ad ? { title: ad.title, slug: ad.slug } : null,
    });
  } catch (e: any) {
    console.error('[payments] create-order error:', e.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

