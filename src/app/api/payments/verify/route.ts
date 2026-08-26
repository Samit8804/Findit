import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';
import { getPaymentProvider } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/verify
 * Headers: Authorization: Bearer <access-token>
 * Body: { order_id (internal uuid), razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Verifies the official payment signature server-side, then atomically
 * marks the order paid + activates the promotion via complete_paid_order().
 * The client CANNOT mark an order paid — only a valid signature can.
 */
export async function POST(req: Request) {
  try {
    if (!isAdminConfigured) return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });
    const admin = getSupabaseAdmin()!;

    const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    const { data: authData } = await admin.auth.getUser(token);
    if (!authData.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const orderId: string | undefined = body?.order_id;
    const rzpOrderId: string | undefined = body?.razorpay_order_id;
    const rzpPaymentId: string | undefined = body?.razorpay_payment_id;
    const signature: string | undefined = body?.razorpay_signature;

    if (!orderId || !rzpOrderId || !rzpPaymentId || !signature) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    /* Order must belong to the caller */
    const { data: order } = await admin
      .from('orders')
      .select('id, user_id, provider_order_id, amount, currency, status')
      .eq('id', orderId)
      .single();

    if (!order || order.user_id !== authData.user.id) {
      return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
    }
    if (order.provider_order_id !== rzpOrderId) {
      return NextResponse.json({ error: 'ORDER_MISMATCH' }, { status: 409 });
    }

    /* Official signature verification */
    const provider = getPaymentProvider();
    const valid = provider.verifyPaymentSignature({
      providerOrderId: rzpOrderId,
      providerPaymentId: rzpPaymentId,
      signature,
    });
    if (!valid) {
      await admin.from('orders').update({ status: 'failed', failure_reason: 'Invalid payment signature' }).eq('id', order.id);
      return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 400 });
    }

    /* Atomic completion (idempotent) */
    const { data: completed } = await admin.rpc('complete_paid_order', {
      p_order_id: order.id,
      p_provider_payment_id: rzpPaymentId,
      p_provider: 'razorpay',
    });

    const { data: updated } = await admin
      .from('orders')
      .select('status')
      .eq('id', order.id)
      .single();

    return NextResponse.json({
      ok: true,
      alreadyProcessed: completed === false,
      status: updated?.status ?? 'paid',
    });
  } catch (e: any) {
    console.error('[payments] verify error:', e.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}