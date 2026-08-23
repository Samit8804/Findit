import type { MetadataRoute } from 'next';
import { detailedCategories } from '@/data/taxonomy';
import { mockListings } from '@/data/mockData';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://findit.example';
  const now = new Date();

  const staticRoutes = [
    '',
    '/browse',
    '/post-ad',
    '/business',
    '/pricing',
    '/help',
    '/contact',
    '/safety',
    '/terms',
    '/privacy',
    '/refund-policy',
    '/advertising-policy',
    '/community-guidelines',
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : 0.7,
  }));

  const categoryRoutes = detailedCategories.map((c) => ({
    url: `${base}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const adRoutes = mockListings.map((l) => ({
    url: `${base}/listing/${l.id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...adRoutes];
}