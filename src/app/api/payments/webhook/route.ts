import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';
import { getPaymentProvider } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/webhook
 * Razorpay calls this with X-Razorpay-Signature header.
 *
 * - Verifies the webhook signature (server-only secret)
 * - Idempotent: complete_paid_order() only transitions once
 */
export async function POST(req: Request) {
  try {
    if (!isAdminConfigured) return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });
    const admin = getSupabaseAdmin()!;

    const signature = req.headers.get('x-razorpay-signature') || '';
    const rawBody = await req.text();

    const provider = getPaymentProvider();
    const event = provider.parseWebhook(rawBody, signature);

    if (!event) {
      return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 400 });
    }

    console.log(`[payments] webhook received: ${event.event} order=${event.providerOrderId}`);

    if (!event.providerOrderId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Find internal order by gateway order id
    const { data: order } = await admin
      .from('orders')
      .select('id, status')
      .eq('provider_order_id', event.providerOrderId)
      .single();

    if (!order) return NextResponse.json({ ok: true, ignored: true });

    switch (event.event) {
      case 'payment.captured':
      case 'order.paid': {
        await admin.rpc('complete_paid_order', {
          p_order_id: order.id,
          p_provider_payment_id: event.providerPaymentId,
          p_provider: 'razorpay',
          p_amount: event.amount,
        });
        break;
      }
      case 'payment.failed': {
        await admin.rpc('mark_order_failed', {
          p_order_id: order.id,
          p_reason: event.failureReason ?? 'Payment failed at gateway',
        });
        break;
      }
      default:
        // refund.processed etc. — handled in a later phase
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[payments] webhook error:', e.message);
    // Never leak internals to the gateway
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}