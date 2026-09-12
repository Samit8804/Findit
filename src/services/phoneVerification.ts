import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Phone verification service for FindIt Post Ad gate.
 * - Indian numbers only, normalized to +91XXXXXXXXXX
 * - Verified phones are unique (partial unique index where phone_verified=true)
 * - Supabase is source of truth (profiles.phone_verified), never localStorage
 * - No mock OTP
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

/**
 * Send OTP via Supabase Phone OTP.
 * IMPORTANT: Supabase phone OTP is primarily an auth method (signInWithOtp).
 * If called while already authenticated via email/password, it MAY replace the current session
 * with a phone session or create a new user depending on shouldCreateUser.
 * For FindIt, phone verification is a second factor, not primary login.
 * The safest production architecture is to either:
 *   1. Use a dedicated phone verification table with own OTP (not Supabase Auth), or
 *   2. Call signInWithOtp with shouldCreateUser:false and immediately verify, then restore email session,
 *   3. Or use supabase.auth.updateUser({phone}) flow to link phone.
 *
 * This service prepares to use signInWithOtp and documents the risk.
 * Callers should be aware and handle session preservation.
 */
export async function sendPhoneOtp(rawPhone: string): Promise<{ normalized: string }> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const { valid, normalized, error } = validateIndianPhoneNumber(rawPhone);
  if (!valid || !normalized) throw new Error(error || 'Invalid phone number');

  // Server-side duplicate check for verified phones (partial index will also enforce)
  const sb = getSupabaseBrowser()!;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Check if another verified account already uses this number
  const { data: dup, error: dupErr } = await sb
    .from('profiles')
    .select('id')
    .eq('phone', normalized)
    .eq('phone_verified', true)
    .neq('id', auth.user.id)
    .limit(1)
    .maybeSingle();
  if (dupErr && dupErr.code !== 'PGRST116') throw new Error(dupErr.message);
  if (dup) throw new Error('This phone number is already verified with another account.');

  // Store the unverified phone first (allowed to change without conflict due to partial index)
  const { error: updErr } = await sb
    .from('profiles')
    .update({ phone: normalized, phone_verified: false, phone_verified_at: null } as any)
    .eq('id', auth.user.id);
  if (updErr) throw new Error(updErr.message);

  // Send OTP via Supabase Auth
  // Note: This may create a phone auth session. Caller must handle session restoration if needed.
  const { error: otpErr } = await sb.auth.signInWithOtp({
    phone: normalized,
    options: { shouldCreateUser: false },
  });
  // shouldCreateUser:false prevents creating new user if phone not linked; if it fails because phone not linked,
  // fallback to allowing creation (first verification) — Supabase will create phone user then we link
  if (otpErr) {
    // If shouldCreateUser:false fails because user does not exist for phone, retry with true for first verification
    const lower = otpErr.message.toLowerCase();
    if (lower.includes('not found') || lower.includes('user does not exist') || lower.includes('shouldcreateuser')) {
      const { error: retryErr } = await sb.auth.signInWithOtp({ phone: normalized });
      if (retryErr) throw new Error(retryErr.message);
    } else {
      throw new Error(otpErr.message);
    }
  }

  return { normalized };
}

export async function verifyPhoneOtp(rawPhone: string, token: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const { valid, normalized, error } = validateIndianPhoneNumber(rawPhone);
  if (!valid || !normalized) throw new Error(error || 'Invalid phone number');
  if (!token || token.trim().length < 4) throw new Error('Enter a valid OTP.');

  const sb = getSupabaseBrowser()!;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Verify OTP via Supabase Auth
  const { data, error: verifyErr } = await sb.auth.verifyOtp({
    phone: normalized,
    token: token.trim(),
    type: 'sms',
  });
  if (verifyErr) throw new Error(verifyErr.message);

  // If verify succeeded, mark phone_verified via secure RPC (bypasses guard, enforces uniqueness)
  const { error: updErr } = await sb.rpc('verify_own_phone', { p_phone: normalized });
  if (updErr) throw new Error(updErr.message);

  // Note: If signInWithOtp replaced the email session with a phone session, the caller should re-authenticate
  // the email user or use a server-side check (is_phone_verified) that does not rely on current session type.
  // For foundation, we do not force signOut here; the verification flag in profiles is what gates Post Ad.

  // Also ensure no mock OTP is used — this function only calls Supabase verifyOtp
}

/**
 * Server-side check helper (to be used in API routes / server components)
 * Example:
 *   const supabase = await createSupabaseServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   const { data: profile } = await supabase.from('profiles').select('phone_verified').eq('id', user.id).single();
 *   if (!profile?.phone_verified) return NextResponse.json({ error: 'PHONE_NOT_VERIFIED' }, { status: 403 });
 */
