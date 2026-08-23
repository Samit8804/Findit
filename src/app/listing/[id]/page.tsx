import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Gallery } from '@/components/listings/Gallery';
import { ShareButton } from '@/components/share/ShareButton';
import { mockListings, categories } from '@/data/mockData';
import {
  MapPin,
  Mail,
  Eye,
  Heart,
  ShieldCheck,
  Clock,
  Globe,
  Building2,
  Hash,
} from 'lucide-react';

interface ListingPageProps {
  params: Promise<{
    id: string;
  }>;
}

export function generateStaticParams() {
  return mockListings.map((l) => ({ id: l.id }));
}

export default async function ListingDetailPage({ params }: ListingPageProps) {
  const { id } = await params;
  const listing = mockListings.find((l) => l.id === id) || mockListings[0];

  const category = categories.find((c) => c.slug === listing.categorySlug);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: 'Browse Ads', href: '/browse' },
              ...(category ? [{ label: category.name, href: `/category/${category.slug}` }] : []),
              { label: listing.subcategory || listing.category },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title card */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {listing.featured && <Badge variant="featured">Featured</Badge>}
                  {listing.promoted && <Badge variant="warning">Promoted</Badge>}
                  {listing.verified && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Ad
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-4">
                  {listing.title}
                </h1>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 mb-6">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#E53935]" /> {listing.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" /> Posted {listing.postedAt}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-slate-400" /> {listing.views} views
                  </span>
                </div>

                <div className="flex items-end justify-between pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Price</p>
                    <p className="text-3xl font-black text-[#E53935]">
                      {listing.currency}
                      {listing.price.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="md" className="gap-2">
                      <Heart className="w-4 h-4" /> Save
                    </Button>
                    <ShareButton title={listing.title} />
                  </div>
                </div>
              </div>

              {/* Image gallery */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-bold mb-4">Photos</h2>
                <Gallery images={listing.images} title={listing.title} />
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-bold mb-3">Description</h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {listing.description}
                </p>

                <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-slate-500 font-medium">Category</span>
                    <Link
                      href={`/category/${listing.categorySlug}`}
                      className="font-semibold text-[#E53935] hover:underline"
                    >
                      {listing.category}
                    </Link>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-slate-500 font-medium">Subcategory</span>
                    <span className="font-semibold text-[#0F172A]">{listing.subcategory}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-slate-500 font-medium">Condition</span>
                    <span className="font-semibold text-[#0F172A] capitalize">
                      {listing.condition.replace(/_/g, ' - ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-slate-500 font-medium">Ad ID</span>
                    <span className="font-semibold text-[#0F172A]">{listing.id.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact card */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-base font-bold mb-4">Contact Seller</h2>
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
                  <div className="w-11 h-11 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center font-black text-lg">
                    {listing.seller.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      {listing.seller.name}
                      {listing.seller.verified && (
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      )}
                    </p>
                    <p className="text-xs text-slate-400">Member since {listing.seller.joinedAt}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <a
                    href={`mailto:${listing.contactEmail}`}
                    className="flex items-center gap-2.5 w-full px-4 py-3 bg-[#E53935] hover:bg-[#D32F2F] transition-colors text-white text-sm font-semibold rounded-xl"
                  >
                    <Mail className="w-4 h-4" /> {listing.contactEmail}
                  </a>
                  <p className="text-xs text-slate-400 text-center">
                    Reply directly via email — responses are usually fast.
                  </p>
                </div>
              </div>

              {/* Full location hierarchy */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-base font-bold mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#E53935]" /> Location Details
                </h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" /> Country
                    </dt>
                    <dd className="font-semibold">{listing.country}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> State / Region
                    </dt>
                    <dd className="font-semibold">{listing.state}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> City
                    </dt>
                    <dd className="font-semibold">{listing.city}</dd>
                  </div>
                  {listing.postalCode && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" /> Postal Code
                      </dt>
                      <dd className="font-semibold">{listing.postalCode}</dd>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-100">
                    <dt className="text-slate-500 text-xs mb-1">Full Address Area</dt>
                    <dd className="font-semibold text-[#0F172A]">{listing.location}</dd>
                  </div>
                </dl>
              </div>

              {/* Safety notice */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Safety Tips
                </h3>
                <ul className="text-xs text-emerald-700 space-y-1.5 leading-relaxed list-disc pl-4">
                  <li>Meet the seller in a safe public place.</li>
                  <li>Inspect the item before making any payment.</li>
                  <li>Never share banking PINs or OTP codes.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Related listings */}
          <section className="mt-14">
            <h2 className="text-xl font-bold mb-6">Related Listings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {mockListings
                .filter((l) => l.id !== listing.id && l.categorySlug === listing.categorySlug)
                .concat(
                  mockListings.filter((l) => l.id !== listing.id && l.categorySlug !== listing.categorySlug)
                )
                .slice(0, 4)
                .map((l) => (
                  <RelatedCard key={l.id} id={l.id} />
                ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function RelatedCard({ id }: { id: string }) {
  return (
    <Link href={`/listing/${id}`} className="block group">
      <MiniListing id={id} />
    </Link>
  );
}

function MiniListing({ id }: { id: string }) {
  const listing = mockListings.find((l) => l.id === id);
  if (!listing) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group-hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <Image
          src={listing.images[0]}
          alt={listing.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4">
        <p className="text-lg font-bold text-[#0F172A]">
          {listing.currency}
          {listing.price.toLocaleString('en-IN')}
        </p>
        <p className="text-xs font-medium text-slate-600 line-clamp-2 mt-1">{listing.title}</p>
        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {listing.city}, {listing.country}
        </p>
      </div>
    </div>
  );
}