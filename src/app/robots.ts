import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/dashboard', '/payment', '/login', '/register'],
      },
    ],
    sitemap: 'https://findit.example/sitemap.xml',
  };
}