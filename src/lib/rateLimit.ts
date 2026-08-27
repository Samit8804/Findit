/** Simple in-memory rate limiter for the demo phase.
 *  In production this would be Redis or DB-backed.
 *  Keys are userId + action.
 */

const buckets = new Map<string, number[]>();

export interface LimitConfig {
  max: number;
  windowMs: number;
}

export const LIMITS: Record<string, LimitConfig> = {
  createAd: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 ads/hour
  newAccountCreateAd: { max: 2, windowMs: 24 * 60 * 60 * 1000 }, // 2/day for <7d accounts
  sendMessage: { max: 20, windowMs: 60 * 1000 }, // 20/min
  report: { max: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  loginAttempt: { max: 5, windowMs: 15 * 60 * 1000 },
};

export function checkRateLimit(userId: string, action: keyof typeof LIMITS): { allowed: boolean; retryAfterMs?: number } {
  const cfg = LIMITS[action];
  if (!cfg) return { allowed: true };
  const key = `${userId}:${action}`;
  const now = Date.now();
  const arr = buckets.get(key) || [];
  const recent = arr.filter((t) => now - t < cfg.windowMs);
  if (recent.length >= cfg.max) {
    const oldest = Math.min(...recent);
    return { allowed: false, retryAfterMs: cfg.windowMs - (now - oldest) };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { allowed: true };
}

export function isNewAccount(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs < 7 * 24 * 60 * 60 * 1000;
}
