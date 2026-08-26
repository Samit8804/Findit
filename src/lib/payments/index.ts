import type { PaymentProvider } from './types';
import { razorpayProvider } from './razorpay';

const providers: Record<string, PaymentProvider> = {
  razorpay: razorpayProvider,
};

/** Swap the active gateway via env without touching app code. */
export function getPaymentProvider(name?: string): PaymentProvider {
  const key = name || process.env.PAYMENT_PROVIDER || 'razorpay';
  return providers[key] ?? razorpayProvider;
}

export type { PaymentProvider, CreateOrderResult, WebhookEvent } from './types';