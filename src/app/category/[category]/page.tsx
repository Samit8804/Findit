import React from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ListingCard } from '@/components/listings/ListingCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { categories, mockListings } from '@/data/mockData';
import Link from 'next/link';

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const categoryData = categories.find((c) => c.slug === categorySlug) || categories[0];
  const categoryListings = mockListings.filter(
    (l) => l.categorySlug.toLowerCase() === categorySlug.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: 'Categories', href: '/browse' },
              { label: categoryData.name },
            ]}
          />

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mb-8 mt-4">
            <h1 className="text-3xl font-black text-[#0F172A] tracking-tight mb-2">
              {categoryData.name} Marketplace
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl mb-6 leading-relaxed">
              Explore thousands of verified listings in {categoryData.name}. Find the best deals, verified sellers, and competitive prices in your local area.
            </p>

            {categoryData.subcategories && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                {categoryData.subcategories.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/browse?category=${categoryData.slug}&subcategory=${sub.slug}`}
                    className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-xs font-semibold text-slate-700 transition-colors border border-slate-200"
                  >
                    {sub.name} ({sub.listingCount.toLocaleString()})
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">
              Available Listings in {categoryData.name} ({categoryListings.length})
            </h2>

            {categoryListings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                <p className="text-sm text-slate-500">
                  No active listings currently available in this category. Check back soon!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {categoryListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>

          {/* SEO Informational Section */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-12 space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">
              Why Buy & Sell {categoryData.name} on FindIt?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              FindIt is India&apos;s fastest growing local classified marketplace. Whether you are looking to upgrade your lifestyle, buy a property, or sell items quickly, our platform provides a secure and transparent ecosystem. All listings undergo strict quality checks to ensure you connect with genuine buyers and verified sellers.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
