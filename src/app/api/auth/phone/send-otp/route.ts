import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeIndianPhoneNumber, validateIndianPhoneNumber } from '@/services/phoneVerification';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone: rawPhone } = body;

    if (!rawPhone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const { valid, normalized, error } = validateIndianPhoneNumber(rawPhone);
    if (!valid || !normalized) {
      return NextResponse.json({ error: error || 'Invalid Indian phone number' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Get current user from session (cookies)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if another verified account already uses this number
    const { data: dup, error: dupErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', normalized)
      .eq('phone_verified', true)
      .neq('id', user.id)
      .limit(1)
      .maybeSingle();

    if (dupErr && dupErr.code !== 'PGRST116') {
      return NextResponse.json({ error: dupErr.message }, { status: 500 });
    }
    if (dup) {
      return NextResponse.json({ error: 'This phone number is already verified with another account.' }, { status: 409 });
    }

    // Store the unverified phone first (partial index allows this)
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ phone: normalized, phone_verified: false, phone_verified_at: null })
      .eq('id', user.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Send OTP via Supabase Auth on the SERVER.
    // This creates a server-side session but does NOT affect the client's session/cookies.
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser: false },
    });

    if (otpErr) {
      const lower = otpErr.message.toLowerCase();
      // If phone not linked to any user, allow creation for first verification
      if (lower.includes('not found') || lower.includes('user does not exist') || lower.includes('shouldcreateuser')) {
        const { error: retryErr } = await supabase.auth.signInWithOtp({ phone: normalized });
        if (retryErr) {
          return NextResponse.json({ error: retryErr.message }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: otpErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ normalized });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to send OTP' }, { status: 500 });
  }
}