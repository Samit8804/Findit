'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ListingCard } from '@/components/listings/ListingCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchResultsSkeleton } from '@/components/ui/Skeleton';
import { detailedCategories } from '@/data/taxonomy';
import { toListingCardData } from '@/lib/publicListing';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  listPromotionRankedAds,
  listPublicAds,
  listPublicCategories,
  listPublicCities,
  PublicAd,
  PublicCategoryOption,
} from '@/services/ads';

const PAGE_SIZE = 24;

type GalleryMode = 'listings' | 'marketplace';

interface GalleryResult {
  key: string;
  ads: PublicAd[];
  hasMore: boolean;
  error?: string;
}

interface FilterOptions {
  categories: PublicCategoryOption[];
  cities: string[];
  error?: string;
}

export function ListingGallery({ mode }: { mode: GalleryMode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchKey = searchParams.toString();
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const category = searchParams.get('category') || '';
  const city = searchParams.get('city') || '';
  const search = searchParams.get('q') || '';
  const featured = searchParams.get('featured') === 'true';
  const [result, setResult] = useState<GalleryResult | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const currentResult = result?.key === searchKey ? result : null;
  const isMarketplace = mode === 'marketplace';

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    Promise.all([listPublicCategories(), listPublicCities()])
      .then(([categories, cities]) => {
        if (!cancelled) setOptions({ categories, cities });
      })
      .catch(() => {
        if (!cancelled) {
          console.error('Failed to load public gallery filter options.');
          setOptions({
            categories: [],
            cities: [],
            error: 'Category and location filters could not be loaded.',
          });
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const params = new URLSearchParams(searchKey);
    const request = {
      page: Math.max(Number(params.get('page')) || 1, 1),
      categorySlug: params.get('category') || undefined,
      citySlug: params.get('city')?.toLowerCase().replace(/\s+/g, '-') || undefined,
      search: params.get('q')?.trim() || undefined,
    };

    const load = isMarketplace
      ? listPublicAds(request)
      : listPromotionRankedAds(request);
    load
      .then((data) => {
        if (!cancelled) setResult({ key: searchKey, ...data });
      })
      .catch(() => {
        if (!cancelled) {
          console.error(`Failed to load ${mode} public advertisements.`);
          setResult({
            key: searchKey,
            ads: [],
            hasMore: false,
            error: 'Advertisements could not be loaded. Please try again.',
          });
        }
      });
    return () => { cancelled = true; };
  }, [isMarketplace, mode, reloadKey, searchKey]);

  const categoryOptions = useMemo(() => {
    if (options) return options.categories;
    if (isSupabaseConfigured) return [];
    return detailedCategories.map(({ id, name, slug }) => ({ id, name, slug }));
  }, [options, isSupabaseConfigured]);

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchKey);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in updates)) next.delete('page');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchKey]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateParams({ q: String(formData.get('q') || '').trim() || null });
  };

  const resetFilters = () => updateParams({ category: null, city: null, q: null, page: null });

  // Filter for featured ads when featured=true parameter is present
  // Filter BEFORE mapping to cards to ensure we only show featured ads
  const filteredAds = useMemo(() => {
    if (!featured) return currentResult?.ads ?? [];
    return (currentResult?.ads ?? []).filter(
      (ad) => ad.promotion?.planType === 'top_30d' || ad.promotion?.planType === 'featured_7d'
    );
  }, [currentResult, featured]);

  const cards = useMemo(() => filteredAds.map(toListingCardData).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [], [filteredAds, page]);
  const heading = isMarketplace ? 'Marketplace' : (featured ? 'Featured Listings' : 'All Listings');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: heading }]} />
          <header className="mb-6 mt-2">
            <h1 className="text-3xl font-black tracking-tight">{heading}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {isMarketplace
                ? 'Discover the newest ads by category and location.'
                : 'Paid placements appear first while active; all other eligible listings follow.'}
            </p>
          </header>

          <section className="mb-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-label="Listing filters">
            <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search advertisements</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  key={search}
                  name="q"
                  defaultValue={search}
                  placeholder="Search listings..."
                  className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                />
              </label>
              <Button type="submit" variant="primary" className="gap-2">
                <Search className="h-4 w-4" /> Search
              </Button>
            </form>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#E53935]" /> Category
                </span>
                <select
                  value={category}
                  onChange={(event) => updateParams({ category: event.target.value || null })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-[#E53935]"
                >
                  <option value="">All categories</option>
                  {category && !categoryOptions.some((item) => item.slug === category) && (
                    <option value={category}>{category.replace(/-/g, ' ')}</option>
                  )}
                  {categoryOptions.map((item) => (
                    <option key={item.id} value={item.slug}>{item.name}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">Location</span>
                <select
                  value={city}
                  onChange={(event) => updateParams({ city: event.target.value || null })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-[#E53935]"
                >
                  <option value="">All locations</option>
                  {city && !(options?.cities || []).includes(city) && <option value={city}>{city}</option>}
                  {(options?.cities || []).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            </div>
            {options?.error && <p role="alert" className="mt-3 text-xs text-amber-700">{options.error}</p>}
            {(category || city || search) && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#E53935]"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </section>

          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">
              {currentResult ? `${cards.length} listing${cards.length === 1 ? '' : 's'} on this page` : 'Loading listings...'}
            </p>
            {isMarketplace && <span className="text-xs text-slate-400">Newest first</span>}
          </div>

          {!isSupabaseConfigured ? (
            <EmptyState title="Marketplace unavailable" description="Connect FindIt to its listings database to browse public advertisements." />
          ) : !currentResult ? (
            <SearchResultsSkeleton />
          ) : currentResult.error ? (
            <div role="alert" className="rounded-2xl border border-red-100 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-[#D32F2F]">{currentResult.error}</p>
              <Button variant="primary" className="mt-4" onClick={() => setReloadKey((key) => key + 1)}>Retry</Button>
            </div>
          ) : cards.length === 0 ? (
            <EmptyState
              title="No advertisements found"
              description="Try another search or clear one of the filters to see more listings."
              actionLabel="Clear filters"
              onAction={resetFilters}
            />
          ) : (
            <>
              <div className={isMarketplace
                ? 'columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4'
                : 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}>
                {cards.map((listing) => (
                  <div key={listing.id} className={isMarketplace ? 'mb-5 break-inside-avoid' : ''}>
                    <ListingCard listing={listing} />
                  </div>
                ))}
              </div>
              <nav aria-label="Listing pages" className="mt-8 flex items-center justify-center gap-3">
                {page > 1 && (
                  <Button variant="outline" onClick={() => updateParams({ page: String(page - 1) })}>
                    Previous
                  </Button>
                )}
                <span className="text-sm text-slate-500">Page {page}</span>
                {currentResult.hasMore && (
                  <Button variant="outline" onClick={() => updateParams({ page: String(page + 1) })}>
                    Next
                  </Button>
                )}
              </nav>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
