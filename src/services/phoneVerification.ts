import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Phone verification service for FindIt Post Ad gate.
 * - Indian numbers only, normalized to +91XXXXXXXXXX
 * - Verified phones are unique (partial unique index where phone_verified=true)
 * - Supabase is source of truth (profiles.phone_verified), never localStorage
 * - No mock OTP
 * - Verification via WhatsApp or Telegram
 */

export function normalizeIndianPhoneNumber(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  let s = input.trim().replace(/[\s\-\(\)]/g, '');
  // Remove leading 0
  if (s.startsWith('0') && !s.startsWith('+')) s = s.slice(1);
  // Handle 919876... without +
  if (s.startsWith('91') && s.length === 12 && !s.startsWith('+')) s = '+' + s;
  // Handle 10-digit without country code
  if (/^[6-9]\d{9}$/.test(s)) s = '+91' + s;
  // Must be +91 + 10 digits (6-9 start)
  if (!/^\+91[6-9]\d{9}$/.test(s)) return null;
  return s;
}

export function validateIndianPhoneNumber(input: string): { valid: boolean; normalized: string | null; error?: string } {
  const normalized = normalizeIndianPhoneNumber(input);
  if (!normalized) {
    return { valid: false, normalized: null, error: 'Enter a valid 10-digit Indian mobile number.' };
  }
  return { valid: true, normalized };
}

export interface PhoneVerificationStatus {
  phone: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
}

export async function getPhoneVerificationStatus(): Promise<PhoneVerificationStatus> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const sb = getSupabaseBrowser()!;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const { data, error } = await sb
    .from('profiles')
    .select('phone, phone_verified, phone_verified_at')
    .eq('id', auth.user.id)
    .single();
  if (error) throw new Error(error.message);
  return {
    phone: (data as any).phone ?? null,
    phoneVerified: !!(data as any).phone_verified,
    phoneVerifiedAt: (data as any).phone_verified_at ?? null,
  };
}

export interface VerificationSession {
  sessionId: string;
  token: string;
  expiresAt: string;
  deepLink: string;
}

export type VerificationMethod = 'whatsapp' | 'telegram';

/**
 * Create a phone verification session via API route.
 * Returns session info including deep link to open WhatsApp/Telegram.
 */
export async function createPhoneVerificationSession(
  rawPhone: string,
  method: VerificationMethod
): Promise<VerificationSession> {
  const { valid, normalized, error } = validateIndianPhoneNumber(rawPhone);
  if (!valid || !normalized) throw new Error(error || 'Invalid phone number');

  const res = await fetch('/api/phone-verification/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalized, method }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create verification session');

  return {
    sessionId: data.session_id,
    token: data.token,
    expiresAt: data.expires_at,
    deepLink: data.deep_link,
  };
}

/**
 * Get verification session status via API route.
 * Used for polling.
 */
export async function getVerificationSessionStatus(sessionId: string): Promise<{
  status: 'pending' | 'verified' | 'expired' | 'failed';
  phone: string;
  verifiedAt: string | null;
  expiresAt: string;
}> {
  const res = await fetch('/api/phone-verification/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get verification status');

  return {
    status: data.status,
    phone: data.phone,
    verifiedAt: data.verified_at,
    expiresAt: data.expires_at,
  };
}

/**
 * Open the deep link for WhatsApp or Telegram verification.
 * This should be called in a user interaction (click handler).
 */
export function openVerificationDeepLink(deepLink: string): void {
  if (typeof window !== 'undefined') {
    window.open(deepLink, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Server-side check helper (to be used in API routes / server components)
 * Example:
 *   const supabase = await createSupabaseServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   const { data: profile } = await supabase.from('profiles').select('phone_verified').eq('id', user.id).single();
 *   if (!profile?.phone_verified) return NextResponse.json({ error: 'PHONE_NOT_VERIFIED' }, { status: 403 });
 */