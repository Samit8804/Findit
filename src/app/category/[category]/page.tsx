import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ListingCard } from '@/components/listings/ListingCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_URL, breadcrumbJsonLd, generateCategoryMetadata, generateSubcategoryMetadata } from '@/lib/seo';
import { detailedCategories } from '@/data/taxonomy';
import { mockListings } from '@/data/mockData';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ subcategory?: string }>;
}

export function generateStaticParams() {
  return detailedCategories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps) {
  const { category: slug } = await params;
  const { subcategory: subSlug } = await searchParams;
  const category = detailedCategories.find((c) => c.slug === slug);
  if (!category) return { title: 'Category Not Found | FindIt' };
  if (subSlug) {
    const sub = category.subcategories.find((s) => s.slug === subSlug);
    if (sub) return generateSubcategoryMetadata(category, sub);
  }
  return generateCategoryMetadata(category);
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const { subcategory: subSlug } = await searchParams;

  const categoryData = detailedCategories.find((c) => c.slug === categorySlug);
  if (!categoryData) notFound();

  // Subcategory mode: filter further when ?subcategory=slug is present
  const isSubcategoryView = !!subSlug;
  const subcategoryData = isSubcategoryView
    ? categoryData.subcategories.find((s) => s.slug === subSlug)
    : undefined;

  if (isSubcategoryView && !subcategoryData) notFound();

  const baseListings = mockListings.filter(
    (l) => l.categorySlug.toLowerCase() === categorySlug.toLowerCase()
  );

  const categoryListings = isSubcategoryView
    ? baseListings.filter((l) => l.subcategory?.toLowerCase().replace(/[^a-z0-9]+/g, '-') === subSlug)
    : baseListings;

  const displayName = subcategoryData ? subcategoryData.name : categoryData.name;
  const h1Text = subcategoryData
    ? `${subcategoryData.name} – ${categoryData.name} for Sale`
    : `${categoryData.name} for Sale`;

  const breadcrumbCrumbs = [
    { name: categoryData.name, path: `/category/${categoryData.slug}` },
    ...(subcategoryData ? [{ name: subcategoryData.name }] : []),
  ];

  const introText = subcategoryData
    ? `Find ${subcategoryData.name.toLowerCase()} in ${categoryData.name.toLowerCase()} on FindIt. Browse verified listings from local sellers, compare prices and contact sellers directly.`
    : `Browse ${categoryData.name.toLowerCase()} for sale from verified sellers in your area on FindIt. Compare prices and contact sellers directly — post your own ad for free.`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <JsonLd data={breadcrumbJsonLd(breadcrumbCrumbs)} />

      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: 'Categories', href: '/browse' },
              { label: categoryData.name, href: `/category/${categoryData.slug}` },
              ...(subcategoryData ? [{ label: subcategoryData.name }] : []),
            ]}
          />

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mb-8 mt-4">
            <h1 className="text-3xl font-black text-[#0F172A] tracking-tight mb-2">{h1Text}</h1>
            <p className="text-sm text-slate-500 max-w-2xl mb-6 leading-relaxed">{introText}</p>

            {/* Subcategory chips → proper category/subcategory URLs (indexable) */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
              {categoryData.subcategories.map((sub) => {
                const isActive = sub.slug === subSlug;
                return (
                  <Link
                    key={sub.id}
                    href={`/category/${categoryData.slug}/${sub.slug}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                      isActive
                        ? 'bg-[#E53935] text-white border-[#E53935]'
                        : 'bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-slate-700 border-slate-200'
                    }`}
                  >
                    {sub.name}
                  </Link>
                );
              })}
            </div>

            {/* Internal linking: category → locations */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-xs font-semibold text-slate-400">Browse in:</span>
              {['noida', 'delhi', 'gurgaon', 'greater-noida'].map((loc) => (
                <Link
                  key={loc}
                  href={`/category/${categoryData.slug}/${loc}`}
                  className="text-xs font-semibold text-[#E53935] hover:underline capitalize"
                >
                  {loc.replace(/-/g, ' ')}
                </Link>
              ))}
              <span className="text-xs text-slate-300">·</span>
              <Link href={`/location/noida`} className="text-xs font-semibold text-[#E53935] hover:underline">
                All locations
              </Link>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">
              {subcategoryData
                ? `${subcategoryData.name} in ${categoryData.name} (${categoryListings.length})`
                : `Available Listings in ${categoryData.name} (${categoryListings.length})`}
            </h2>

            {categoryListings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                <p className="text-sm text-slate-500">
                  No active listings currently available
                  {subcategoryData ? ` for ${subcategoryData.name}` : ` in ${categoryData.name}`}. Check back soon!
                </p>
                <Link href="/browse" className="inline-block mt-4 text-sm font-semibold text-[#E53935] hover:underline">
                  Browse all ads
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {categoryListings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>

          {/* SEO introductory content - unique per category */}
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-12 space-y-4" aria-labelledby="why-findit">
            <h2 id="why-findit" className="text-lg font-bold text-[#0F172A]">
              Why Buy & Sell {displayName} on FindIt?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {subcategoryData
                ? `Looking for ${subcategoryData.name.toLowerCase()}? FindIt connects you with verified sellers offering ${subcategoryData.name.toLowerCase()} within ${categoryData.name.toLowerCase()} across Noida, Delhi, Gurgaon and beyond. Every listing is checked for authenticity — compare prices, view detailed photos and chat directly with sellers.`
                : `FindIt is India's trusted local classified marketplace for ${categoryData.name.toLowerCase()}. Whether you are upgrading, decluttering or starting a business, post a free ad in ${categoryData.name} and reach thousands of nearby buyers, or browse ${categoryData.listingCount.toLocaleString()} verified listings today.`}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
