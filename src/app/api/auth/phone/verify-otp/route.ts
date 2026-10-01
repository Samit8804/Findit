import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeIndianPhoneNumber, validateIndianPhoneNumber } from '@/services/phoneVerification';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone: rawPhone, token } = body;

    if (!rawPhone || !token) {
      return NextResponse.json({ error: 'Phone number and OTP required' }, { status: 400 });
    }

    const { valid, normalized, error } = validateIndianPhoneNumber(rawPhone);
    if (!valid || !normalized) {
      return NextResponse.json({ error: error || 'Invalid Indian phone number' }, { status: 400 });
    }

    if (!token || token.trim().length < 4) {
      return NextResponse.json({ error: 'Enter a valid OTP.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Get current user from session (cookies)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify OTP via Supabase Auth on the SERVER.
    // This verifies the OTP but does NOT affect the client's session/cookies.
    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: token.trim(),
      type: 'sms',
    });

    if (verifyErr) {
      const lower = verifyErr.message.toLowerCase();
      let status = 400;
      let message = verifyErr.message;
      if (lower.includes('expired') || lower.includes('expired otp')) {
        message = 'OTP has expired. Please request a new code.';
      } else if (lower.includes('invalid') || lower.includes('incorrect')) {
        message = 'Invalid OTP. Please check the code and try again.';
      }
      return NextResponse.json({ error: message }, { status });
    }

    // OTP verified successfully. Now mark phone as verified via secure RPC.
    // The RPC enforces: user can only verify their own phone, prevents duplicate verified phones.
    const { error: updErr } = await supabase.rpc('verify_own_phone', { p_phone: normalized });
    if (updErr) {
      const lower = updErr.message.toLowerCase();
      if (lower.includes('already verified') || lower.includes('already associated')) {
        return NextResponse.json({ error: 'This phone number is already verified with another account.' }, { status: 409 });
      }
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Success - client's email session is preserved (we never touched client cookies)
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to verify OTP' }, { status: 500 });
  }
}