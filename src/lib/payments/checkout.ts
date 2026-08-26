'use client';

/** Loads Razorpay's official checkout.js once and opens secure checkout. */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface CheckoutArgs {
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  name?: string;
  description?: string;
  prefillEmail?: string;
  onSuccess: (res: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss: () => void;
}

export async function openRazorpayCheckout(args: CheckoutArgs): Promise<void> {
  const ok = await loadRazorpayScript();
  if (!ok || !(window as any).Razorpay) throw new Error('CHECKOUT_LOAD_FAILED');

  const rzp = new (window as any).Razorpay({
    key: args.keyId,
    amount: args.amountPaise,
    currency: 'INR',
    name: args.name || 'FindIt Marketplace',
    description: args.description || '',
    order_id: args.providerOrderId,
    prefill: args.prefillEmail ? { email: args.prefillEmail } : undefined,
    theme: { color: '#E53935' },
    handler: args.onSuccess,
    modal: { ondismiss: args.onDismiss },
  });
  rzp.open();
}

export async function createOrderApi(
  adId: string | null,
  promotionSlug: string
): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  providerOrderId: string;
  promotion: { name: string };
}> {
  const { getAccessToken } = await import('@/services/payments');
  const token = await getAccessToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const res = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ad_id: adId, promotion_slug: promotionSlug }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'ORDER_CREATE_FAILED');
  return body;
}

export async function verifyPaymentApi(args: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{ status: string }> {
  const { getAccessToken } = await import('@/services/payments');
  const token = await getAccessToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      order_id: args.orderId,
      razorpay_order_id: args.razorpayOrderId,
      razorpay_payment_id: args.razorpayPaymentId,
      razorpay_signature: args.razorpaySignature,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'VERIFY_FAILED');
  return body;
}