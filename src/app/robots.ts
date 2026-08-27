import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/ad/', '/category/', '/location/', '/business/'],
        disallow: [
          '/admin/',
          '/dashboard',
          '/dashboard/',
          '/messages',
          '/favorites',
          '/payment',
          '/payment/',
          '/api/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}