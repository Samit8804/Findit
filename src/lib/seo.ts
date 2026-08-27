import type { Metadata } from 'next';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'FindIt';

interface SeoInput {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  noindex?: boolean;
  /** Optional nofollow override; defaults to noindex value. */
  nofollow?: boolean;
}

/** Canonical, Open Graph & Twitter metadata for any public page. */
export function buildSeo({ title, description, path, image, noindex, nofollow }: SeoInput): Metadata {
  const url = `${SITE_URL}${path}`;
  const shouldNoIndex = !!noindex;
  const shouldNoFollow = nofollow ?? shouldNoIndex;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: shouldNoIndex
      ? { index: false, follow: !shouldNoFollow }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/* ---------------- JSON-LD builders ---------------- */

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
  };
}

export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/browse?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  path?: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', item: SITE_URL }, ...crumbs].map(
      (c: any, i: number) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        ...(c.item || c.path ? { item: c.item ?? `${SITE_URL}${c.path}` } : {}),
      })
    ),
  };
}

export function productJsonLd(ad: {
  title: string;
  description: string;
  price: number;
  currency: string;
  imageUrl?: string;
  url: string;
  city?: string;
  sold?: boolean;
  category?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: ad.title,
    description: ad.description.slice(0, 300),
    ...(ad.imageUrl ? { image: [ad.imageUrl] } : {}),
    ...(ad.category ? { category: ad.category } : {}),
    offers: {
      '@type': 'Offer',
      url: ad.url,
      priceCurrency: ad.currency === '₹' ? 'INR' : ad.currency,
      price: String(ad.price),
      availability: ad.sold
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      ...(ad.city ? { areaServed: { '@type': 'City', name: ad.city } } : {}),
    },
  };
}

export function localBusinessJsonLd(b: {
  name: string;
  description?: string;
  imageUrl?: string;
  phone?: string;
  website?: string;
  address: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: b.name,
    ...(b.description ? { description: b.description } : {}),
    ...(b.imageUrl ? { image: b.imageUrl } : {}),
    address: { '@type': 'PostalAddress', streetAddress: b.address },
    ...(b.phone ? { telephone: b.phone } : {}),
    ...(b.website ? { url: b.website } : {}),
  };
}

/* ---------------- Centralized metadata helpers ---------------- */

export function generateHomeMetadata(): Metadata {
  return buildSeo({
    title: 'FindIt – Buy & Sell Classified Ads Near You',
    description:
      'Discover local classifieds on FindIt — buy and sell vehicles, property, mobiles, jobs, services and trusted businesses near you. Post free ads and connect with verified sellers across India.',
    path: '/',
  });
}

export function generateCategoryMetadata(category: { name: string; slug: string; description?: string }): Metadata {
  const title = `${category.name} for Sale – Buy & Sell ${category.name} | FindIt`;
  const description =
    category.description ||
    `Browse ${category.name.toLowerCase()} for sale from verified sellers in your area on FindIt. Compare prices and contact sellers directly.`;
  return buildSeo({ title, description, path: `/category/${category.slug}` });
}

export function generateSubcategoryMetadata(
  category: { name: string; slug: string },
  subcategory: { name: string; slug: string }
): Metadata {
  const title = `${subcategory.name} – ${category.name} for Sale | FindIt`;
  const description = `Find ${subcategory.name.toLowerCase()} in ${category.name.toLowerCase()} on FindIt. Browse verified listings, compare prices and connect with local sellers.`;
  return buildSeo({ title, description, path: `/category/${category.slug}/${subcategory.slug}` });
}

export function generateLocationMetadata(location: { name: string; slug: string }): Metadata {
  const title = `Buy & Sell in ${location.name} – Local Classified Ads | FindIt`;
  const description = `Find products, vehicles, property, jobs and services available in ${location.name}. Browse verified local classifieds on FindIt.`;
  return buildSeo({ title, description, path: `/location/${location.slug}` });
}

export function generateCategoryLocationMetadata(
  category: { name: string; slug: string },
  location: { name: string; slug: string }
): Metadata {
  const title = `${category.name} for Sale in ${location.name} | FindIt`;
  const description = `Browse ${category.name.toLowerCase()} for sale in ${location.name} from verified local sellers on FindIt. Compare prices and contact sellers directly.`;
  return buildSeo({ title, description, path: `/category/${category.slug}/${location.slug}` });
}

export function generateAdMetadata(ad: {
  title: string;
  slug: string;
  description: string;
  price?: number;
  currency?: string;
  category?: string;
  location?: string;
  imageUrl?: string;
  status?: string;
}): Metadata {
  const isIndexable =
    ad.status === 'approved' || ad.status === undefined; // mock listings are implicitly approved

  const citySuffix = ad.location ? ` in ${ad.location}` : '';
  const pricePart = ad.price ? ` – ₹${Number(ad.price).toLocaleString('en-IN')}` : '';
  const title = `${ad.title} for Sale${citySuffix} | FindIt`;
  const description = `${ad.title}${citySuffix}${ad.category ? ` in ${ad.category}` : ''}${pricePart}. ${ad.description.slice(0, 120)}`.slice(0, 155);

  return buildSeo({
    title,
    description,
    path: `/ad/${ad.slug}`,
    image: ad.imageUrl || undefined,
    noindex: !isIndexable,
  });
}

export function generateBusinessMetadata(business: {
  name: string;
  slug: string;
  description: string;
  category: string;
  location: string;
  verified?: boolean;
  cover?: string;
}): Metadata {
  const title = `${business.name} – ${business.category} in ${business.location} | FindIt`;
  const description = `${business.description.slice(0, 130)} Find verified ${business.category.toLowerCase()} services in ${business.location} on FindIt.`;
  return buildSeo({
    title,
    description,
    path: `/business/${business.slug}`,
    image: business.cover || undefined,
  });
}
