import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Browse Classified Ads – FindIt',
  description:
    'Browse thousands of verified classified ads on FindIt — filter by category, location, price and condition. Find vehicles, property, mobiles, jobs and services near you.',
  alternates: { canonical: `${SITE_URL}/browse` },
  robots: { index: true, follow: true },
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
