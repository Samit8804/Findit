import { createHmac, timingSafeEqual } from 'crypto';
import type {
  CreateOrderResult,
  PaymentProvider,
  VerifyInput,
  WebhookEvent,
} from './types';

const BASE = 'https://api.razorpay.com/v1';

function authHeader(): string | null {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) return null;
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

/** Official Razorpay verification: HMAC-SHA256(order_id + '|' + payment_id, key_secret) */
function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  try {
    const expected = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest();
    const given = Buffer.from(signature, 'hex');
    if (given.length !== expected.length) return false;
    return timingSafeEqual(given, expected);
  } catch {
    return false;
  }
}

export const razorpayProvider: PaymentProvider = {
  name: 'razorpay',
  get configured() {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  },

  async createOrder({ internalOrderId, amount, currency, description }) {
    const auth = authHeader();
    if (!auth) throw new Error('RAZORPAY_NOT_CONFIGURED');

    const r = await fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency,
        receipt: internalOrderId,
        notes: { description },
      }),
    });
    const body: any = await r.json();
    if (!r.ok) throw new Error(body?.error?.description || `Razorpay order failed (${r.status})`);

    const result: CreateOrderResult = {
      providerOrderId: body.id,
      publicKeyId: process.env.RAZORPAY_KEY_ID, // public — safe for client checkout
      amount: body.amount,
      currency: body.currency,
    };
    return result;
  },

  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }: VerifyInput) {
    return verifySignature(providerOrderId, providerPaymentId, signature);
  },

  parseWebhook(rawBody: string, signature: string): WebhookEvent | null {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature) return null;

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    } catch {
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return null;
    }

    const event: string = parsed?.event ?? '';
    const entity = parsed?.payload?.payment?.entity ?? {};
    const orderEntity = parsed?.payload?.order?.entity ?? {};

    return {
      event,
      providerOrderId: entity.order_id ?? orderEntity.id ?? null,
      providerPaymentId: entity.id ?? null,
      amount: entity.amount != null ? entity.amount / 100 : null,
      failureReason:
        event === 'payment.failed' ? (entity.error_description ?? 'Payment failed') : null,
      raw: parsed,
    };
  },

  async refundPayment(providerPaymentId: string, amount: number) {
    const auth = authHeader();
    if (!auth) return { refunded: false, reason: 'Razorpay not configured' };
    try {
      const r = await fetch(`${BASE}/payments/${providerPaymentId}/refund`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(amount > 0 ? { amount: Math.round(amount * 100) } : {}),
      });
      if (!r.ok) {
        const t = await r.text();
        return { refunded: false, reason: t.slice(0, 120) };
      }
      return { refunded: true };
    } catch (e: any) {
      return { refunded: false, reason: e.message };
    }
  },
};