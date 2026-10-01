import { createSupabaseServerClient } from '@/lib/supabase/server';
import { validateIndianPhoneNumber } from '@/services/phoneVerification';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, method } = body;

    if (!phone || !method) {
      return NextResponse.json({ error: 'Phone and method required' }, { status: 400 });
    }

    if (!['whatsapp', 'telegram'].includes(method)) {
      return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
    }

    const { valid, normalized, error } = validateIndianPhoneNumber(phone);
    if (!valid || !normalized) {
      return NextResponse.json({ error: error || 'Invalid Indian phone number' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check duplicate verified phone
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

    // Call the database function to create session
    const { data, error: rpcErr } = await supabase.rpc('create_phone_verification_session', {
      p_phone: normalized,
      p_method: method,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    const session = data[0];
    return NextResponse.json({
      session_id: session.session_id,
      token: session.token,
      expires_at: session.expires_at,
      deep_link: session.deep_link,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create verification session' }, { status: 500 });
  }
}