'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ListingCard } from '@/components/listings/ListingCard';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { LocationSelector, LocationValue } from '@/components/location/LocationSelector';
import { getCountryByIso, getStateByIso } from '@/lib/locationData';
import { mockListings } from '@/data/mockData';
import { detailedCategories } from '@/data/taxonomy';
import { listPublicAds, PublicAd } from '@/services/ads';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { SearchResultsSkeleton } from '@/components/ui/Skeleton';
import {
  Tag,
  ChevronDown,
  RotateCcw,
  Search,
} from 'lucide-react';

function BrowseContent() {
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get('q') || '');
  const [location, setLocation] = useState<LocationValue>(() => ({
    countryIso: '',
    stateIso: '',
    city: searchParams.get('city') || '',
  }));
  const [categorySlug, setCategorySlug] = useState(() => searchParams.get('category') || '');
  const [subcategorySlug, setSubcategorySlug] = useState(() => searchParams.get('subcategory') || '');

  const selectedCountry = getCountryByIso(location.countryIso);
  const selectedState = getStateByIso(location.countryIso, location.stateIso);
  const selectedCategory = detailedCategories.find((c) => c.slug === categorySlug);
  const selectedSubcategory = selectedCategory?.subcategories.find((s) => s.slug === subcategorySlug);

  /* ---------- Real Supabase data (when configured) ---------- */
  const citySlug = useMemo(
    () => (location.city ? location.city.toLowerCase().replace(/\s+/g, '-') : ''),
    [location.city]
  );
  const [remote, setRemote] = useState<{ ads: PublicAd[]; hasMore: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRemote(null);
      return;
    }
    let cancelled = false;
    setLoadingRemote(true);
    setRemoteError('');
    listPublicAds({
      page,
      categorySlug: categorySlug || undefined,
      subcategorySlug: subcategorySlug || undefined,
      citySlug: citySlug || undefined,
    })
      .then((res) => { if (!cancelled) setRemote(res); })
      .catch(() => { if (!cancelled) setRemoteError('Unable to load advertisements.'); })
      .finally(() => { if (!cancelled) setLoadingRemote(false); });
    return () => { cancelled = true; };
  }, [isSupabaseConfigured, page, categorySlug, subcategorySlug, citySlug]);

  useEffect(() => { setPage(1); }, [categorySlug, subcategorySlug, citySlug]);

  /** Adapter: PublicAd -> ListingCard props shape */
  const toCard = useCallback((ad: PublicAd) => ({
    id: ad.id,
    title: ad.title,
    description: ad.description,
    price: ad.price,
    currency: '₹',
    images: ad.images.map((i) => i.url),
    category: ad.categoryName,
    categorySlug: ad.categorySlug,
    location: ad.locationLabel || ad.city || '',
    locationSlug: ad.city ?? '',
    postedAt: new Date(ad.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    condition: (ad.condition as any) || 'used_good',
    featured: ad.isFeatured,
    promoted: false,
    verified: ad.seller.verified,
    views: ad.viewsCount,
    favorites: ad.favoritesCount,
    contactEmail: '',
    seller: { name: ad.seller.name, verified: ad.seller.verified, joinedAt: '', email: '' },
  }), []);

  const resetAll = () => {
    setLocation({ countryIso: '', stateIso: '', city: '' });
    setCategorySlug('');
    setSubcategorySlug('');
    setKeyword('');
  };

  const activeParts = [
    selectedCountry?.name,
    selectedState?.name,
    location.city,
    selectedCategory?.name,
    selectedSubcategory?.name,
  ].filter(Boolean) as string[];

  const filteredListings = useMemo(() => {
    let result = [...mockListings];
    if (selectedCountry) result = result.filter((l) => l.countryCode === selectedCountry.isoCode);
    if (selectedState) result = result.filter((l) => l.stateCode === selectedState.isoCode);
    if (location.city) {
      result = result.filter(
        (l) =>
          l.city.toLowerCase() === location.city.toLowerCase() ||
          l.citySlug === location.city.toLowerCase().replace(/\s+/g, '-')
      );
    }
    if (selectedCategory) result = result.filter((l) => l.categorySlug === selectedCategory.slug);
    if (selectedSubcategory) result = result.filter((l) => l.subcategory === selectedSubcategory.name);
    if (keyword.trim()) {
      const q = keyword.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q)
      );
    }
    return result;
  }, [selectedCountry, selectedState, location.city, selectedCategory, selectedSubcategory, keyword]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: 'Browse Ads' }]} />

          {/* Page header */}
          <div className="mb-6 mt-2">
            <h1 className="text-3xl font-black tracking-tight">Browse Ads</h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeParts.length > 0 ? (
                <>
                  Showing results for{' '}
                  <span className="font-semibold text-[#0F172A]">{activeParts.join(' › ')}</span>
                </>
              ) : (
                'Drill down by location and category to find exactly what you need.'
              )}
            </p>
          </div>

          {/* Cascading drill-down panel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8 space-y-5">
            {/* Location cascade */}
            <LocationSelector value={location} onChange={setLocation} />

            {/* Category cascade + reset */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#E53935]" /> Category
                </label>
                <div className="relative">
                  <select
                    value={categorySlug}
                    onChange={(e) => {
                      setCategorySlug(e.target.value);
                      setSubcategorySlug('');
                    }}
                    className="w-full appearance-none px-4 py-3 pr-9 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                  >
                    <option value="">All categories</option>
                    {detailedCategories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name} ({c.listingCount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#E53935]" /> Subcategory
                </label>
                <div className="relative">
                  <select
                    value={subcategorySlug}
                    disabled={!selectedCategory}
                    onChange={(e) => setSubcategorySlug(e.target.value)}
                    className={`w-full appearance-none px-4 py-3 pr-9 border rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-[#E53935] focus:border-transparent transition-colors ${
                      !selectedCategory ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-[#0F172A]'
                    }`}
                  >
                    <option value="">
                      {selectedCategory ? 'All subcategories' : 'Choose a category first'}
                    </option>
                    {selectedCategory?.subcategories.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Keyword + reset row */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search within results..."
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                />
              </div>
              <Button variant="outline" size="md" onClick={resetAll} className="gap-2 shrink-0">
                <RotateCcw className="w-4 h-4" /> Reset Filters
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm font-semibold text-slate-700">
              {loadingRemote
                ? 'Loading advertisements...'
                : isSupabaseConfigured && remote
                ? `${remote.ads.length} advertisement${remote.ads.length !== 1 ? 's' : ''} on this page`
                : `${filteredListings.length} listing${filteredListings.length !== 1 ? 's' : ''} found`}
            </p>
          </div>

          {loadingRemote ? (
            <SearchResultsSkeleton />
          ) : remoteError ? (
            <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
              <p className="text-sm font-semibold text-[#D32F2F]">{remoteError}</p>
              <button onClick={() => setPage((p) => p)} className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold">Retry</button>
            </div>
          ) : isSupabaseConfigured && remote ? (
            remote.ads.length === 0 ? (
              <EmptyState
                title="No advertisements found."
                description="Try widening your location or category filters — or be the first to post an ad here."
                actionLabel="Reset Filters"
                onAction={resetAll}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-4">
                  {remote.ads.map((ad) => (
                    <ListingCard key={ad.id} listing={toCard(ad) as any} />
                  ))}
                </div>
                {remote.hasMore && (
                  <div className="flex justify-center pb-8">
                    <Button variant="outline" onClick={() => setPage((p) => p + 1)} className="gap-2">
                      Load More
                    </Button>
                  </div>
                )}
              </>
            )
          ) : filteredListings.length === 0 ? (
            <EmptyState
              title="No ads match your selection"
              description="Try widening your location or category filters — or be the first to post an ad here."
              actionLabel="Reset Filters"
              onAction={resetAll}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-8">
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <p className="text-sm font-medium text-slate-400">Loading listings...</p>
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}