export interface PlanMessagingConfig {
  messagingAccess?: boolean | null;
}

export interface MessagingAccess {
  allowed: boolean;
  isAdmin: boolean;
  planName: string | null;
  expiresAt: string | null;
  reason: string;
  configured: boolean;
}

export type ConversationRole = 'buyer' | 'seller';

export interface SubscriptionRecord {
  id: string;
  promotionId: string | null;
  plan: string;
  status: string;
  startsAt?: string | null;
  endsAt: string | null;
  promotion?: PlanMessagingConfig | null;
}

/** Messaging is controlled by the explicit admin flag, never by price. */
export function isEligibleMessagingPlan(
  plan: PlanMessagingConfig | null | undefined
): boolean {
  return plan?.messagingAccess === true;
}

export function isSubscriptionActive(sub: SubscriptionRecord, now: Date = new Date()): boolean {
  if (sub.status !== 'active') return false;
  if (sub.startsAt) {
    const starts = new Date(sub.startsAt);
    if (!Number.isFinite(starts.getTime()) || starts.getTime() > now.getTime()) return false;
  }
  if (!sub.endsAt) return true;
  const ends = new Date(sub.endsAt);
  return Number.isFinite(ends.getTime()) && ends.getTime() > now.getTime();
}

export function evaluateMessagingEntitlement(input: {
  isAdmin?: boolean;
  subscriptions: SubscriptionRecord[];
  now?: Date;
}): boolean {
  if (input.isAdmin) return true;
  const now = input.now ?? new Date();
  return input.subscriptions.some((sub) => {
    if (!isSubscriptionActive(sub, now)) return false;
    if (!sub.promotionId) {
      return sub.plan === 'business' || sub.plan === 'business-pro';
    }
    return isEligibleMessagingPlan(sub.promotion);
  });
}

export function canBuyerSendMessage(access: MessagingAccess | null | undefined, role: ConversationRole): boolean {
  if (role === 'seller') return true;
  return access?.allowed === true;
}

export function computeRenewalEnd(
  currentEndsAt: string | null | undefined,
  durationDays: number,
  now: Date = new Date()
): string {
  const current = currentEndsAt ? new Date(currentEndsAt) : null;
  const currentMs = current && Number.isFinite(current.getTime()) ? current.getTime() : 0;
  const baseMs = Math.max(currentMs, now.getTime());
  const days = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 30;
  return new Date(baseMs + days * 24 * 60 * 60 * 1000).toISOString();
}

export interface NextActivation {
  action: 'insert' | 'extend';
  promotionId: string;
  orderId: string;
  endsAt: string;
}

/** Mirrors the SQL activation rule: one active row per plan, renewed from the
 * later of its current expiry and now. */
export function nextSubscriptionActivation(input: {
  subscriptions: SubscriptionRecord[];
  promotionId: string;
  durationDays: number;
  orderId: string;
  now?: Date;
}): NextActivation {
  const now = input.now ?? new Date();
  const active = input.subscriptions.find(
    (sub) => sub.promotionId === input.promotionId && isSubscriptionActive(sub, now)
  );
  return {
    action: active ? 'extend' : 'insert',
    promotionId: input.promotionId,
    orderId: input.orderId,
    endsAt: computeRenewalEnd(active?.endsAt, input.durationDays, now),
  };
}

export function canActivatePaidOrder(status: string): boolean {
  return status === 'created' || status === 'pending';
}

export function formatMessagingExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function planDisplayName(access: MessagingAccess | null | undefined): string {
  if (!access) return 'Free plan';
  if (access.isAdmin) return 'Admin';
  return access.planName || 'Free plan';
}

export function planAccessCaption(access: MessagingAccess | null | undefined): string {
  if (!access) return 'Checking plan access…';
  if (access.isAdmin) return 'Staff access — messaging enabled';
  if (!access.allowed) return 'Messaging is not included in your current plan.';
  const expiry = formatMessagingExpiry(access.expiresAt);
  return expiry ? `Messaging active until ${expiry}` : 'Messaging active';
}
