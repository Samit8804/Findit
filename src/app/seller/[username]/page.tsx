'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, Calendar, Filter, Flag, MapPin, MessageSquare, Search, SearchX, Share2, ShieldCheck, Zap } from 'lucide-react';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ListingCard } from '@/components/listings/ListingCard';
import { getUsernameValidationError } from '@/lib/username';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getAdUrl } from '@/lib/adUrl';
import { getPublicSellerByUsername, getSellerAds, getSellerBusiness, SellerBusiness, SellerWithAds } from '@/services/seller';

type SellerPageResult =
  | { username: string; status: 'not-found' | 'error' }
  | { username: string; status: 'loaded'; seller: SellerWithAds; business: SellerBusiness };

function SellerProfileContent() {
  const params = useParams<{ username: string }>();
  const username = (params.username || '').toLowerCase();
  const invalidUsername = !!getUsernameValidationError(username);
  const [result, setResult] = useState<SellerPageResult | null>(null);
  const currentResult = result?.username === username ? result : null;

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (invalidUsername || !isSupabaseConfigured) {
      return;
    }

    let cancelled = false;

    const fetchSeller = async () => {
      try {
        const profile = await getPublicSellerByUsername(username);
        if (cancelled) return;

        if (!profile) {
          setResult({ username, status: 'not-found' });
          return;
        }

        const [ads, business] = await Promise.all([
          getSellerAds(profile.id),
          getSellerBusiness(profile.id),
        ]);

        if (cancelled) return;

        setResult({ username, status: 'loaded', seller: { profile, ads }, business });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load public seller page.', error);
          setResult({ username, status: 'error' });
        }
      }
    };

    fetchSeller();

    return () => {
      cancelled = true;
    };
  }, [invalidUsername, username]);

  if (!invalidUsername && isSupabaseConfigured && !currentResult) {
    return <SellerProfileSkeleton />;
  }

  const notFound = invalidUsername || currentResult?.status === 'not-found';
  const unavailable = !invalidUsername && (!isSupabaseConfigured || currentResult?.status === 'error');

  if (notFound || unavailable) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
        <Header />
        <main className="flex-grow flex items-center justify-center py-16 px-4 text-center">
          <div className="max-w-md">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <SearchX className="w-10 h-10 text-[#E53935]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-3">{unavailable ? 'Profile temporarily unavailable' : 'Seller not found'}</h1>
            <p className="text-sm text-slate-500 leading-relaxed mb-8">
              {unavailable
                ? 'We could not load this seller profile right now. Please try again later.'
                : 'This seller profile doesn’t exist or isn’t publicly available.'}
            </p>
            <Link href="/browse" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-lg shadow-red-200">
              Browse Ads <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!currentResult || currentResult.status !== 'loaded') {
    return null;
  }

  const { profile, ads } = currentResult.seller;
  const business = currentResult.business;
  const primaryImage = profile.avatar_url || null;

  const filteredAds = useMemo(() => {
    return [...ads]
      .filter((ad) => {
        const searchValue = searchQuery.trim().toLowerCase();
        const matchesSearch =
          searchValue.length === 0 ||
          ad.title.toLowerCase().includes(searchValue) ||
          ad.category_name.toLowerCase().includes(searchValue) ||
          ad.location_name.toLowerCase().includes(searchValue);

        const matchesCategory = selectedCategory === 'All' || ad.category_name === selectedCategory;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price_low':
            return a.price - b.price;
          case 'price_high':
            return b.price - a.price;
          case 'popular':
            return b.views_count - a.views_count;
          case 'newest':
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
  }, [ads, searchQuery, selectedCategory, sortBy]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    ads.forEach((ad) => {
      if (ad.category_name) cats.add(ad.category_name);
    });
    return ['All', ...Array.from(cats).sort()];
  }, [ads]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:w-2/3">
                <div className="relative shrink-0">
                  {primaryImage ? (
                    <img
                      src={primaryImage}
                      alt={profile.display_name}
                      width={96}
                      height={96}
                      className="w-24 h-24 rounded-2xl object-cover shadow-lg ring-4 ring-white"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-[#E53935] text-white font-black text-4xl flex items-center justify-center shadow-lg shadow-red-200">
                      {(profile.display_name || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {profile.phone_verified && (
                    <span className="absolute -bottom-1 -right-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">{profile.display_name}</h1>
                    {profile.phone_verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold shrink-0">
                        <ShieldCheck className="w-3 h-3" /> Phone Verified
                      </span>
                    )}
                    {profile.email_verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold shrink-0">
                        <ShieldCheck className="w-3 h-3" /> Email Verified
                      </span>
                    )}
                    {profile.business_verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-bold shrink-0">
                        <ShieldCheck className="w-3 h-3" /> Business Verified
                      </span>
                    )}
                    {business && business.verification_status === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold shrink-0">
                        <ShieldCheck className="w-3 h-3" /> Verified Business
                      </span>
                    )}
                    {profile.account_type === 'business' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
                        <Zap className="w-3 h-3" /> Business Account
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {profile.location_text || 'Location not specified'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Member since {new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </p>

                  {business && business.verification_status === 'verified' && (
                    <p className="text-sm text-emerald-600 flex items-center gap-1 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Business — {business.business_category}
                    </p>
                  )}

                  {profile.bio && (
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed line-clamp-3">{profile.bio}</p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-slate-100">
                    <button
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#E53935] hover:text-[#E53935] transition-colors"
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: `${profile.display_name}'s Profile on FindIt`,
                            text: `Check out ${profile.display_name}'s listings on FindIt`,
                            url: window.location.href,
                          });
                        } else {
                          navigator.clipboard.writeText(window.location.href);
                          alert('Profile link copied to clipboard!');
                        }
                      }}
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Share Profile</span>
                    </button>
                    <Link
                      href={`/dashboard/messages?seller=${profile.username}`}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-semibold transition-colors shadow-md shadow-red-200"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Contact Seller</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="lg:hidden">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#E53935] hover:text-[#E53935] transition-colors"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `${profile.display_name}'s Profile on FindIt`,
                          text: `Check out ${profile.display_name}'s listings on FindIt`,
                          url: window.location.href,
                        });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        alert('Profile link copied to clipboard!');
                      }
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                  <Link
                    href={`/dashboard/messages?seller=${profile.username}`}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-semibold transition-colors shadow-md shadow-red-200"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Contact</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
            <div className="lg:w-2/3">
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-bold">
                      {ads.length === 0 ? 'No active listings' : `Active Listings (${ads.length})`}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {ads.length === 0 ? 'This seller has no active listings at the moment.' : 'Browse their active listings below.'}
                    </p>
                  </div>
                  <button
                    className="sm:hidden inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#E53935] hover:text-[#E53935] transition-colors"
                    onClick={() => setMobileFiltersOpen((prev) => !prev)}
                  >
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
                  </button>
                </div>

                <div className={`flex flex-wrap gap-3 mb-6 ${mobileFiltersOpen ? 'block' : 'hidden sm:flex'}`}>
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search listings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                  >
                    <option value="newest">Newest First</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                    <option value="popular">Most Popular</option>
                  </select>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                  >
                    <option value="All">All Categories</option>
                    {uniqueCategories
                      .filter((cat) => cat !== 'All')
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="mb-4 text-sm text-slate-500">
                  {filteredAds.length === 0 ? 'No listings found' : `${filteredAds.length} listing${filteredAds.length !== 1 ? 's' : ''} found`}
                </div>

                {filteredAds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-14 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-5">
                      <SearchX className="w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-bold mb-1.5">No listings found</h3>
                    <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
                      Try adjusting your search or filters to find listings.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                        setSortBy('newest');
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredAds.map((ad) => (
                      <Link key={ad.id} href={getAdUrl(ad.slug)} className="block">
                        <ListingCard
                          listing={{
                            id: ad.id,
                            slug: ad.slug,
                            title: ad.title,
                            price: ad.price,
                            images: ad.images.map((img) => img.url),
                            category: ad.category_name,
                            location: ad.location_name,
                            postedAt: new Date(ad.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                            condition: 'used_good',
                            featured: false,
                            promoted: false,
                            verified: false,
                            views: ad.views_count,
                            favorites: ad.favorites_count,
                            contactEmail: '',
                            seller: {
                              name: profile.display_name,
                              verified: profile.phone_verified || profile.email_verified,
                              showPhone: false,
                              showWhatsApp: false,
                              allowMessages: true,
                            },
                          }}
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="lg:w-72 lg:sticky lg:top-24 lg:self-start">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-lg font-bold mb-4">About this seller</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <dt className="text-xs text-slate-400">Location</dt>
                      <dd className="font-medium text-slate-900">{profile.location_text || 'Not specified'}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <dt className="text-xs text-slate-400">Member since</dt>
                      <dd className="font-medium text-slate-900">{new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
                    </div>
                  </div>
                  {profile.phone_verified && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <dd className="font-medium text-emerald-700">Phone verified</dd>
                    </div>
                  )}
                  {profile.email_verified && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                      <dd className="font-medium text-blue-700">Email verified</dd>
                    </div>
                  )}
                  {profile.business_verified && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0" />
                      <dd className="font-medium text-sky-700">Business verified</dd>
                    </div>
                  )}
                  {business && business.verification_status === 'verified' && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <dd className="font-medium text-emerald-700">Verified Business — {business.business_category}</dd>
                    </div>
                  )}
                  {profile.account_type === 'business' && (
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-500 shrink-0" />
                      <dd className="font-medium text-purple-700">Business Account</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      window.location.href = `/contact?seller=${profile.username}`;
                    }}
                    className="w-full py-2.5 rounded-xl border-2 border-[#E53935] text-[#E53935] font-bold hover:bg-red-50 transition-colors"
                  >
                    <Flag className="w-4 h-4 mr-2" /> Report Seller
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SellerProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <main className="flex-grow py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="animate-pulse space-y-8">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-2xl bg-slate-200" />
              <div className="flex-1 space-y-3">
                <div className="h-8 w-48 bg-slate-200 rounded" />
                <div className="h-4 w-64 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="aspect-[4/3] w-full rounded-xl bg-slate-200 mb-3" />
                <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                <div className="h-8 w-1/2 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function SellerPage() {
  return (
    <Suspense fallback={<SellerProfileSkeleton />}>
      <SellerProfileContent />
    </Suspense>
  );
}
