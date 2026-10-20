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

    const isRefund = event.event === 'refund.processed' || event.event === 'payment.refunded';
    if (!event.providerOrderId && !(isRefund && event.providerPaymentId)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Find internal order by gateway order id (or payment id for refunds)
    let order: { id: string; status: string; amount: number } | null = null;
    if (event.providerOrderId) {
      const { data } = await admin
        .from('orders')
        .select('id, status, amount')
        .eq('provider_order_id', event.providerOrderId)
        .single();
      order = data;
    }
    if (!order && isRefund && event.providerPaymentId) {
      const { data } = await admin
        .from('orders')
        .select('id, status, amount')
        .eq('provider_payment_id', event.providerPaymentId)
        .single();
      order = data;
    }

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
      case 'refund.processed':
      case 'payment.refunded': {
        if (event.amount == null) {
          return NextResponse.json({ ok: true, ignored: true });
        }
        const fullRefund = Number(event.amount) >= Number(order.amount);
        const { error: refundError } = await admin
          .from('orders')
          .update({
            status: fullRefund ? 'refunded' : 'partially_refunded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);
        if (refundError) {
          console.error('[payments] refund update failed:', refundError.message);
          return NextResponse.json({ error: 'REFUND_UPDATE_FAILED' }, { status: 500 });
        }
        if (fullRefund) {
          const { error: revokeError } = await admin.rpc('revoke_subscription_for_order', {
            p_order_id: order.id,
          });
          if (revokeError) {
            console.error('[payments] refund revoke failed:', revokeError.message);
            return NextResponse.json({ error: 'REFUND_REVOKE_FAILED' }, { status: 500 });
          }
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[payments] webhook error:', e instanceof Error ? e.message : String(e));
    // Never leak internals to the gateway
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}