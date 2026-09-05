import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as any;
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  const supabase = await createSupabaseServerClient();

  // PKCE code flow (newer Supabase link format with ?code=...)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error('[auth/confirm] exchangeCodeForSession failed:', error.message);
    return NextResponse.redirect(new URL('/auth/verification-failed', request.url));
  }

  // Token hash flow (type=signup/recovery/email_change etc. + token_hash)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error('[auth/confirm] verifyOtp failed:', error.message);
    // Expired/invalid -> specific page
    const lower = (error.message || '').toLowerCase();
    if (lower.includes('expired')) {
      return NextResponse.redirect(new URL('/auth/expired', request.url));
    }
    return NextResponse.redirect(new URL('/auth/verification-failed', request.url));
  }

  console.error('[auth/confirm] missing token_hash/type and code');
  return NextResponse.redirect(new URL('/auth/verification-failed', request.url));
}
