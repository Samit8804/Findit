'import React';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ListingCard } from '@/components/listings/ListingCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { categories, locations, mockListings } from '@/data/mockData';
import Link from 'next/link';

interface CategoryLocationPageProps {
  params: Promise<{
    category: string;
    location: string;
  }>;
}

export function generateStaticParams() {
  return categories.flatMap((c) =>
    locations.map((l) => ({ category: c.slug, location: l.slug }))
  );
}

export default async function CategoryLocationPage({ params }: CategoryLocationPageProps) {
  const { category: categorySlug, location: locationSlug } = await params;
  const categoryData = categories.find((c) => c.slug === categorySlug) || categories[0];
  const locationData = locations.find((l) => l.slug === locationSlug) || locations[0];

  const filteredListings = mockListings.filter(
    (l) =>
      l.categorySlug.toLowerCase() === categorySlug.toLowerCase() &&
      l.locationSlug.toLowerCase() === locationSlug.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: 'Categories', href: '/browse' },
              { label: categoryData.name, href: `/category/${categorySlug}` },
              { label: locationData.name },
            ]}
          />

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mb-8 mt-4">
            <h1 className="text-3xl font-black text-[#0F172A] tracking-tight mb-2">
              {categoryData.name} in {locationData.name}
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl mb-6 leading-relaxed">
              Discover the best {categoryData.name.toLowerCase()} deals, verified offers, and local sellers in {locationData.name}. Post your ad for free or browse verified listings today.
            </p>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
              {locations.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/category/${categorySlug}/${loc.slug}`}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                    loc.slug === locationSlug
                      ? 'bg-[#E53935] text-white border-[#E53935]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {categoryData.name} in {loc.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">
              Listing Results ({filteredListings.length})
            </h2>

            {filteredListings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                <p className="text-sm text-slate-500 mb-2">
                  No listings found for {categoryData.name} in {locationData.name}.
                </p>
                <p className="text-xs text-slate-400">
                  Try exploring other nearby locations or browse all categories.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>

          {/* SEO Content Section */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-12 space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">
              About {categoryData.name} in {locationData.name}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {locationData.name} is one of the most active commercial hubs. Buying and selling {categoryData.name.toLowerCase()} in {locationData.name} has never been easier. With FindIt, you get direct access to verified local buyers and sellers without any brokerage or middleman fees.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
