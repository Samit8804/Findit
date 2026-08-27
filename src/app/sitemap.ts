import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { detailedCategories } from '@/data/taxonomy';
import { locations as mockLocations } from '@/data/mockData';
import { businesses as businessDataFallback } from '@/data/businessData';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600; // refresh hourly — new/expired ads reflected

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entry = (
    path: string,
    priority: number,
    changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'hourly',
    lastModified?: Date
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: lastModified ?? now,
    changeFrequency,
    priority,
  });

  /* Static public pages */
  const statics: MetadataRoute.Sitemap = [
    entry('', 1, 'daily'),
    entry('/browse', 0.9, 'daily'),
    entry('/business', 0.7, 'weekly'),
    entry('/pricing', 0.5, 'weekly'),
    entry('/help', 0.4, 'monthly'),
    entry('/safety', 0.4, 'monthly'),
    entry('/contact', 0.4, 'monthly'),
    entry('/terms', 0.3, 'yearly'),
    entry('/privacy', 0.3, 'yearly'),
    entry('/refund-policy', 0.3, 'yearly'),
    entry('/community-guidelines', 0.3, 'yearly'),
    entry('/advertising-policy', 0.3, 'yearly'),
  ];

  /* Category + subcategory pages (path-based for SEO) */
  const categoryRoutes: MetadataRoute.Sitemap = [];
  for (const c of detailedCategories) {
    categoryRoutes.push(entry(`/category/${c.slug}`, 0.8, 'daily'));
    for (const s of c.subcategories) {
      categoryRoutes.push(entry(`/category/${c.slug}/${s.slug}`, 0.6, 'daily'));
    }
  }

  /* Category + location combos (only useful combos - all categories x 5 core locations) */
  const categoryLocationRoutes: MetadataRoute.Sitemap = [];
  for (const c of detailedCategories.slice(0, 6)) {
    for (const loc of mockLocations) {
      categoryLocationRoutes.push(entry(`/category/${c.slug}/${loc.slug}`, 0.6, 'weekly'));
    }
  }

  /* Location pages */
  const locationRoutes: MetadataRoute.Sitemap = [];
  if (url && key) {
    const sb = createClient(url, key);
    try {
      const { data: cities } = await sb.from('locations').select('slug').eq('level', 'city');
      const slugs = cities && cities.length > 0 ? cities.map((c: any) => c.slug) : mockLocations.map((l) => l.slug);
      for (const slug of slugs) {
        locationRoutes.push(entry(`/location/${slug}`, 0.7, 'daily'));
      }
    } catch {
      for (const loc of mockLocations) {
        locationRoutes.push(entry(`/location/${loc.slug}`, 0.7, 'daily'));
      }
    }
  } else {
    for (const loc of mockLocations) {
      locationRoutes.push(entry(`/location/${loc.slug}`, 0.7, 'daily'));
    }
  }

  /* Business pages */
  const businessRoutes: MetadataRoute.Sitemap = businessDataFallback.map((b) =>
    entry(`/business/${b.slug}`, 0.6, 'weekly')
  );

  /* Approved advertisements only */
  let adRoutes: MetadataRoute.Sitemap = [];
  if (url && key) {
    const sb = createClient(url, key);
    try {
      const { data: ads } = await sb
        .from('ads')
        .select('slug, updated_at')
        .eq('status', 'approved')
        .is('deleted_at', null)
        .or('expires_at.is.null,expires_at.gt.' + now.toISOString())
        .order('published_at', { ascending: false })
        .limit(5000);
      adRoutes = (ads || []).map((a: any) =>
        entry(`/ad/${a.slug}`, 0.8, 'weekly', new Date(a.updated_at))
      );
    } catch {
      /* skip ads on failure */
    }
  }

  return [...statics, ...categoryRoutes, ...categoryLocationRoutes, ...locationRoutes, ...businessRoutes, ...adRoutes];
}
