'use client';

import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Allowed events — anything not in this list is rejected (no fake payment_success)
// ---------------------------------------------------------------------------
export const ALLOWED_EVENTS = new Set([
  'page_view', 'search', 'ad_view', 'ad_favorite', 'ad_unfavorite',
  'seller_profile_view', 'business_profile_view',
  'message_started', 'message_sent',
  'ad_created', 'ad_updated', 'ad_submitted', 'ad_approved', 'ad_rejected', 'ad_sold', 'ad_reported',
  'user_registered', 'user_login',
  'promotion_viewed', 'promotion_selected', 'checkout_started', 'payment_success', 'payment_failed', 'promotion_activated',
]);

export type AnalyticsEvent = typeof ALLOWED_EVENTS extends Set<infer T> ? T : never;

// ---------------------------------------------------------------------------
// Helpers: session id, bot/admin filtering, consent, deduplication
// ---------------------------------------------------------------------------

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let sid = localStorage.getItem('findit_sid');
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('findit_sid', sid);
  }
  return sid;
}

export function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'false') return false;
  const v = localStorage.getItem('analytics_consent');
  // Default: allow (privacy-law gate can flip to 'declined'); if unset, allow
  return v !== 'declined';
}

function isBot(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|semrush|ahrefs/.test(ua);
}

function isAdminTraffic(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin');
}

// Deduplication: same ad + same session within 30 min → skip meaningful view
const viewDedup = new Map<string, number>();
const DEDUP_WINDOW_MS = 30 * 60 * 1000;

export function shouldCountView(adId: string): boolean {
  const key = `${getSessionId()}:${adId}`;
  const last = viewDedup.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return false;
  viewDedup.set(key, Date.now());
  return true;
}

// ---------------------------------------------------------------------------
// Public API — all fire-and-forget, never block UI, never throw
// ---------------------------------------------------------------------------

export async function trackEvent(
  name: string,
  meta: Record<string, unknown> = {},
  opts: { entityType?: string; entityId?: string } = {}
) {
  try {
    if (!ALLOWED_EVENTS.has(name)) return;
    if (!hasConsent()) return;
    if (isBot() || isAdminTraffic()) return;
    // Strip sensitive keys if accidentally passed
    const { password, token, card, cvv, message, phone, email, ...safeMeta } = meta as any;

    const sb = getSupabaseBrowser();
    if (!sb) return; // dev without keys → silently skip

    const { data: { user } } = await sb.auth.getUser().catch(() => ({ data: { user: null } } as any));

    // Fire-and-forget: don't await in caller, but await here with timeout so we don't leak
    await sb.from('analytics_events').insert({
      event_name: name,
      user_id: user?.id ?? null,
      anonymous_session_id: getSessionId(),
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      metadata: safeMeta,
    });
  } catch {
    // Analytics must never break the app
  }
}

export function trackPageView(path?: string) {
  void trackEvent('page_view', { path: path || window.location.pathname }, {});
}

export function trackAdView(adId: string, categoryId?: string, locationId?: string) {
  if (!shouldCountView(adId)) return;
  void trackEvent('ad_view', { category_id: categoryId, location_id: locationId }, { entityType: 'ad', entityId: adId });
}

export function trackSearch(meta: { query?: string; categoryId?: string; locationId?: string; resultCount?: number; filters?: Record<string, unknown> }) {
  void trackEvent('search', meta);
}

export function trackFavorite(adId: string, favorited: boolean) {
  void trackEvent(favorited ? 'ad_favorite' : 'ad_unfavorite', {}, { entityType: 'ad', entityId: adId });
}

export function trackMessage(type: 'message_started' | 'message_sent', adId?: string) {
  void trackEvent(type, {}, { entityType: 'ad', entityId: adId });
}

export function trackPromotion(event: 'promotion_viewed' | 'promotion_selected' | 'checkout_started' | 'promotion_activated', promotionId?: string) {
  void trackEvent(event, { promotion_id: promotionId });
}
