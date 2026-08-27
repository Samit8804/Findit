import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ListingCard } from '@/components/listings/ListingCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, generateCategoryLocationMetadata, generateSubcategoryMetadata } from '@/lib/seo';
import { detailedCategories } from '@/data/taxonomy';
import { locations, mockListings } from '@/data/mockData';

interface Props {
  params: Promise<{ category: string; location: string }>;
}

export function generateStaticParams() {
  const combos: { category: string; location: string }[] = [];
  for (const cat of detailedCategories) {
    for (const loc of locations) {
      combos.push({ category: cat.slug, location: loc.slug });
    }
    for (const sub of cat.subcategories) {
      combos.push({ category: cat.slug, location: sub.slug });
    }
  }
  return combos;
}

export async function generateMetadata({ params }: Props) {
  const { category: catSlug, location: locSlug } = await params;
  const category = detailedCategories.find((c) => c.slug === catSlug);
  if (!category) return { title: 'Not Found | FindIt' };

  // Check if locSlug is a subcategory
  const sub = category.subcategories.find((s) => s.slug === locSlug);
  if (sub) return generateSubcategoryMetadata(category, sub);

  const location = locations.find((l) => l.slug === locSlug);
  if (location) return generateCategoryLocationMetadata(category, location);

  // Fallback: treat as category+location string
  return generateCategoryLocationMetadata(category, { name: locSlug, slug: locSlug } as any);
}

export default async function CategoryLocationPage({ params }: Props) {
  const { category: catSlug, location: secondSlug } = await params;
  const category = detailedCategories.find((c) => c.slug === catSlug);
  if (!category) notFound();

  const subcategory = category.subcategories.find((s) => s.slug === secondSlug);
  const location = locations.find((l) => l.slug === secondSlug);

  // ---- Subcategory view: /category/vehicles/cars ----
  if (subcategory) {
    const listings = mockListings.filter(
      (l) => l.categorySlug === catSlug && l.subcategory?.toLowerCase().replace(/[^a-z0-9]+/g, '-') === secondSlug
    );

    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
        <Header />
        <JsonLd data={breadcrumbJsonLd([
          { name: category.name, path: `/category/${category.slug}` },
          { name: subcategory.name },
        ])} />
        <main className="flex-grow py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs items={[
              { label: 'Categories', href: '/browse' },
              { label: category.name, href: `/category/${category.slug}` },
              { label: subcategory.name },
            ]} />
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-4 mb-8">
              <h1 className="text-3xl font-black tracking-tight mb-2">{subcategory.name} – {category.name} for Sale</h1>
              <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">Find {subcategory.name.toLowerCase()} in {category.name.toLowerCase()} on FindIt. Browse verified listings from local sellers, compare prices and contact sellers directly.</p>
            </div>
            <h2 className="text-xl font-bold mb-6">{subcategory.name} Listings ({listings.length})</h2>
            {listings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                <p className="text-sm text-slate-500">No listings for {subcategory.name} yet.</p>
                <Link href="/post-ad" className="inline-block mt-4 text-sm font-semibold text-[#E53935] hover:underline">Post an Ad</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-12">
              <h2 className="text-lg font-bold mb-3">About {subcategory.name}</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">Discover {subcategory.name.toLowerCase()} deals on FindIt — verified sellers, competitive prices and direct chat with owners across Delhi NCR.</p>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ---- Category + Location view ----
  if (!location) notFound();
  const filtered = mockListings.filter(
    (l) => l.categorySlug.toLowerCase() === catSlug.toLowerCase() && l.locationSlug.toLowerCase() === secondSlug.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <JsonLd data={breadcrumbJsonLd([
        { name: category.name, path: `/category/${category.slug}` },
        { name: location.name, path: `/location/${location.slug}` },
        { name: `${category.name} in ${location.name}` },
      ])} />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[
            { label: 'Categories', href: '/browse' },
            { label: category.name, href: `/category/${category.slug}` },
            { label: location.name, href: `/location/${location.slug}` },
          ]} />
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mb-8 mt-4">
            <h1 className="text-3xl font-black tracking-tight mb-2">{category.name} for Sale in {location.name}</h1>
            <p className="text-sm text-slate-500 max-w-2xl mb-6 leading-relaxed">
              Browse {category.name.toLowerCase()} for sale in {location.name} from verified local sellers on FindIt. Compare prices and contact sellers directly.
            </p>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
              {locations.map((loc) => (
                <Link key={loc.id} href={`/category/${category.slug}/${loc.slug}`}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border ${loc.slug === secondSlug ? 'bg-[#E53935] text-white border-[#E53935]' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {category.name} in {loc.name}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-xs font-semibold text-slate-400 py-2">Or browse:</span>
              {detailedCategories.slice(0, 6).map((cat) => (
                <Link key={cat.id} href={`/category/${cat.slug}/${location.slug}`} className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-xs font-medium border border-slate-200">
                  {cat.name} in {location.name}
                </Link>
              ))}
            </div>
          </div>

          <h2 className="text-xl font-bold mb-6">Listing Results ({filtered.length})</h2>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <p className="text-sm text-slate-500 mb-2">No listings found for {category.name} in {location.name}.</p>
              <Link href="/browse" className="text-sm font-semibold text-[#E53935] hover:underline">Browse all ads</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filtered.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
            </div>
          )}

          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mt-12">
            <h2 className="text-lg font-bold mb-3">About {category.name} in {location.name}</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {location.name} is one of the most active classified hubs. Buying and selling {category.name.toLowerCase()} in {location.name} has never been easier. With FindIt, you get direct access to verified local buyers and sellers without brokerage fees.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
