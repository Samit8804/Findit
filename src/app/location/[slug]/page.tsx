import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ListingCard } from '@/components/listings/ListingCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, generateLocationMetadata } from '@/lib/seo';
import { locations, mockListings } from '@/data/mockData';
import { detailedCategories } from '@/data/taxonomy';

interface LocationPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return locations.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: LocationPageProps) {
  const { slug } = await params;
  const loc = locations.find((l) => l.slug === slug);
  if (!loc) return { title: 'Location Not Found | FindIt' };
  return generateLocationMetadata(loc);
}

export default async function LocationPage({ params }: LocationPageProps) {
  const { slug } = await params;
  const location = locations.find((l) => l.slug === slug);
  if (!location) notFound();

  const listings = mockListings.filter((l) => l.locationSlug === slug);
  const nearbyLocations = locations.filter((l) => l.slug !== slug);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <JsonLd data={breadcrumbJsonLd([{ name: location.name, path: `/location/${location.slug}` }])} />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: location.name }]} />

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-4 mb-8">
            <h1 className="text-3xl font-black tracking-tight mb-2">Classified Ads in {location.name}</h1>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed mb-6">
              Find products, vehicles, property, jobs and services available in {location.name}. Browse {location.listingCount.toLocaleString()} verified local classifieds on FindIt — post your free ad today or connect with trusted sellers nearby.
            </p>

            {/* Internal linking: location → categories */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-400 py-2">Browse by category in {location.name}:</span>
              {detailedCategories.slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}/${location.slug}`}
                  className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-xs font-semibold border border-slate-200 transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
              <Link href="/browse" className="px-4 py-2 rounded-xl bg-[#E53935] text-white text-xs font-semibold">View All</Link>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-6">Latest Listings in {location.name} ({listings.length})</h2>

          {listings.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <p className="text-sm text-slate-500">No listings yet in {location.name}. Be the first to post!</p>
              <Link href="/post-ad" className="inline-block mt-4 text-sm font-semibold text-[#E53935] hover:underline">Post an Ad</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}

          {/* Internal linking: nearby locations */}
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-12">
            <h2 className="text-lg font-bold mb-4">Explore Nearby Locations</h2>
            <div className="flex flex-wrap gap-2">
              {nearbyLocations.map((loc) => (
                <Link key={loc.id} href={`/location/${loc.slug}`} className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-xs font-semibold border border-slate-200">
                  {loc.name} ({loc.listingCount.toLocaleString()})
                </Link>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4">Discover local deals across Delhi NCR and beyond.</p>
          </section>

          {/* SEO content */}
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-8">
            <h2 className="text-lg font-bold mb-3">Why FindIt for {location.name}?</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {location.name} is one of the most active classified hubs in the region. From affordable rentals and verified property deals to second-hand mobiles, vehicles and job opportunities — FindIt makes local discovery simple. Post a free ad in {location.name} today and connect with thousands of nearby buyers and sellers without middlemen.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
