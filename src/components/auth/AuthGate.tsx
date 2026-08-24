'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

/** Routes that never require authentication. */
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/help',
  '/contact',
  '/safety',
  '/terms',
  '/privacy',
  '/refund-policy',
  '/advertising-policy',
  '/community-guidelines',
];

function AuthSplash() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-[#E53935] text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-red-200 animate-pulse">
        F
      </div>
      <p className="text-sm font-medium text-slate-400">Checking your session…</p>
    </div>
  );
}

/**
 * Auth-first gate:
 *  - Guests are redirected to /login from every private page.
 *  - Authenticated users hitting "/" are sent to the main dashboard.
 *  - When Supabase is not configured (demo mode) nothing is gated,
 *    so the site keeps working exactly as before.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'authed' | 'guest'>(
    isSupabaseConfigured ? 'loading' : 'authed'
  );

  const isPublic =
    pathname.startsWith('/admin') ||
    PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('authed');
      return;
    }
    const sb = getSupabaseBrowser();
    if (!sb) {
      setStatus('guest');
      return;
    }

    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? 'authed' : 'guest');
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (active) setStatus(session ? 'authed' : 'guest');
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* Redirect rules */
  useEffect(() => {
    if (isSupabaseConfigured && !isPublic) {
      if (status === 'guest') {
        router.replace('/login');
        return;
      }
      if (status === 'authed' && pathname === '/') {
        router.replace('/dashboard');
        return;
      }
    }
  }, [status, isPublic, isSupabaseConfigured, pathname, router]);

  /* Admin stays ungated at the UI level (RLS + role checks secure data),
     auth pages and support/legal stay public. */
  if (isPublic) return <>{children}</>;

  if (status !== 'authed') return <AuthSplash />;

  return <>{children}</>;
}