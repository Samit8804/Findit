/** Provider-agnostic payment abstraction.
 *  Adding Cashfree/PayPal later = implement this interface. */

export interface CreateOrderResult {
  providerOrderId: string;
  /** Public key id for client checkout (Razorpay checkout needs it). */
  publicKeyId?: string;
  amount: number; // in currency sub-units handled by provider impl
  currency: string;
}

export interface VerifyInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface WebhookEvent {
  event: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: number | null;
  failureReason: string | null;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  readonly configured: boolean;
  createOrder(args: {
    internalOrderId: string;
    amount: number;
    currency: string;
    description: string;
    customerEmail?: string;
    customerName?: string;
  }): Promise<CreateOrderResult>;
  verifyPaymentSignature(input: VerifyInput): boolean;
  parseWebhook(rawBody: string, signature: string): WebhookEvent | null;
  refundPayment(providerPaymentId: string, amount: number): Promise<{ refunded: boolean; reason?: string }>;
}