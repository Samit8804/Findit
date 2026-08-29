'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

export function AnalyticsPageView() {
  const pathname = usePathname();
  useEffect(() => {
    // Only public pages
    if (pathname.startsWith('/admin') || pathname.startsWith('/dashboard')) return;
    trackPageView(pathname);
  }, [pathname]);
  return null;
}
