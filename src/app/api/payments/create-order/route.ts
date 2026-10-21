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
    const adId: string | null =
      typeof body?.ad_id === 'string' && body.ad_id.trim() ? body.ad_id.trim() : null;
    const promotionSlug: string =
      typeof body?.promotion_slug === 'string' ? body.promotion_slug.trim() : '';

    /* 2. Price, duration and messaging access always come from the DB. */
    const { data: promo, error: promoErr } = await admin
      .from('promotions')
      .select('id, name, slug, type, plan_type, price, currency, duration_days, is_active, messaging_access')
      .eq('slug', promotionSlug)
      .single();

    if (promoErr || !promo) {
      return NextResponse.json({ error: 'PROMOTION_NOT_FOUND' }, { status: 404 });
    }
    if (!promo.is_active) {
      return NextResponse.json({ error: 'PROMOTION_UNAVAILABLE' }, { status: 409 });
    }

    /* 3. One shared eligibility check for every configured plan type. */
    const { data: eligibility, error: eligibilityErr } = await admin.rpc(
      'evaluate_ad_plan_eligibility',
      {
        p_ad_id: adId,
        p_promotion_id: promo.id,
        p_user_id: user.id,
        p_duration_days: null,
      },
    );

    if (eligibilityErr) {
      console.error('[payments] eligibility check failed:', eligibilityErr.message);
      return NextResponse.json({ error: 'ELIGIBILITY_CHECK_FAILED' }, { status: 500 });
    }
    if (!eligibility?.eligible) {
      return NextResponse.json(
        {
          error: eligibility?.reason ?? 'PLAN_NOT_ELIGIBLE',
          reason: eligibility?.reason ?? 'PLAN_NOT_ELIGIBLE',
          detail: eligibility?.message ?? 'This plan is not available for the selected advertisement.',
        },
        { status: 409 },
      );
    }

    let ad: { id: string; title: string; slug: string } | null = null;
    if (adId) {
      const { data: adRow, error: adErr } = await admin
        .from('ads')
        .select('id, title, slug')
        .eq('id', adId)
        .single();
      if (adErr || !adRow) {
        return NextResponse.json({ error: 'AD_NOT_FOUND' }, { status: 404 });
      }
      ad = adRow;
    }

    /* 4. Create internal order with immutable purchase terms. */
    const capturedAt = new Date().toISOString();
    const amount = Number(promo.price);
    const benefitSnapshot = {
      promotion_id: promo.id,
      slug: promo.slug,
      name: promo.name,
      promotion_type: promo.type,
      plan_type: promo.plan_type,
      duration_days: promo.duration_days,
      messaging_access: promo.messaging_access === true,
      price: amount,
      currency: promo.currency,
      captured_at: capturedAt,
    };

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        ad_id: ad?.id ?? null,
        promotion_id: promo.id,
        amount,
        currency: promo.currency,
        subtotal: amount,
        total_amount: amount,
        provider: 'razorpay',
        status: 'created',
        metadata: {
          promotion_name: promo.name,
          duration_days: promo.duration_days,
          plan_type: promo.plan_type,
          benefit_snapshot: benefitSnapshot,
        },
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
        description: `FindIt — ${promo.name}${ad ? ` (${ad.title})` : ''}`,
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
      promotion: { name: promo.name, duration_days: promo.duration_days, plan_type: promo.plan_type },
      ad: ad ? { title: ad.title, slug: ad.slug } : null,
    });
  } catch (e: any) {
    console.error('[payments] create-order error:', e.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

