import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Business Directory – Trusted Local Businesses | FindIt',
  description:
    'Discover trusted local businesses on FindIt — shops, studios and verified service providers near you. Read reviews, compare and connect in one tap.',
  alternates: { canonical: `${SITE_URL}/business` },
  robots: { index: true, follow: true },
};

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
