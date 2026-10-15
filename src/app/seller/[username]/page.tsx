'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Flag,
  MapPin,
  MessageSquare,
  Search,
  SearchX,
  Share2,
  ShieldCheck,
} from 'lucide-react';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ListingCard } from '@/components/listings/ListingCard';
import { getUsernameValidationError } from '@/lib/username';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { getPublicSellerByUsername, getSellerAds, getSellerBusiness, SellerBusiness, SellerWithAds } from '@/services/seller';

type SellerPageResult =
  | { username: string; status: 'not-found' | 'error' }
  | { username: string; status: 'loaded'; seller: SellerWithAds; business: SellerBusiness | null };

const REPORT_REASONS = ['Spam', 'Scam or fraud', 'Harassment', 'Impersonation', 'Other'];

function SellerProfileContent() {
  const params = useParams<{ username: string }>();
  const username = (params.username || '').toLowerCase();
  const invalidUsername = !!getUsernameValidationError(username);
  const [result, setResult] = useState<SellerPageResult | null>(null);
  const currentResult = result?.username === username ? result : null;
  const profile = currentResult?.status === 'loaded' ? currentResult.seller.profile : null;
  const ads = currentResult?.status === 'loaded' ? currentResult.seller.ads : [];
  const business = currentResult?.status === 'loaded' ? currentResult.business : null;

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [shareMessage, setShareMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportRequiresLogin, setReportRequiresLogin] = useState(false);

  const filteredAds = useMemo(() => {
    const searchValue = searchQuery.trim().toLowerCase();

    return [...ads]
      .filter((ad) => {
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
    return ['All', ...Array.from(new Set(ads.map((ad) => ad.category_name).filter(Boolean))).sort()];
  }, [ads]);

  useEffect(() => {
    if (invalidUsername || !isSupabaseConfigured) return;

    let cancelled = false;

    const fetchSeller = async () => {
      try {
        const sellerProfile = await getPublicSellerByUsername(username);
        if (cancelled) return;

        if (!sellerProfile) {
          setResult({ username, status: 'not-found' });
          return;
        }

        const [sellerAds, sellerBusiness] = await Promise.all([
          getSellerAds(sellerProfile.id),
          getSellerBusiness(sellerProfile.id),
        ]);
        if (cancelled) return;

        setResult({
          username,
          status: 'loaded',
          seller: { profile: sellerProfile, ads: sellerAds },
          business: sellerBusiness,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load public seller page.', error);
          setResult({ username, status: 'error' });
        }
      }
    };

    void fetchSeller();
    return () => {
      cancelled = true;
    };
  }, [invalidUsername, username]);

  const shareProfile = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.display_name ?? 'Seller'} on FindIt`,
          text: `View ${profile?.display_name ?? 'this seller'}'s public profile on FindIt`,
          url,
        });
        setShareMessage('');
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareMessage('Profile link copied.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        setShareMessage('Profile link copied.');
      } catch {
        console.error('Unable to share seller profile.');
        setShareMessage('Unable to share the profile link on this device.');
      }
    }
  };

  const resetReport = () => {
    setReportOpen(false);
    setReportReason('');
    setReportDescription('');
    setReportError('');
    setReportSubmitted(false);
    setReportRequiresLogin(false);
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportError('');

    if (!profile || !reportReason) {
      setReportError('Choose a reason before submitting your report.');
      return;
    }
    if (reportDescription.trim().length > 1000) {
      setReportError('Description must be 1000 characters or fewer.');
      return;
    }

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setReportError('Reporting is temporarily unavailable. Please try again later.');
      return;
    }

    setReportSending(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) {
        setReportRequiresLogin(true);
        return;
      }
      if (auth.user.id === profile.id) {
        setReportError('You cannot report your own profile.');
        return;
      }

      const { error } = await supabase.from('reports').insert({
        reporter_id: auth.user.id,
        reported_user_id: profile.id,
        reason: reportReason,
        description: reportDescription.trim() || null,
      });
      if (error) throw error;

      setReportSubmitted(true);
    } catch (error) {
      console.error('Failed to submit seller report.', error);
      setReportError('We could not submit your report. Please try again.');
    } finally {
      setReportSending(false);
    }
  };

  if (!invalidUsername && isSupabaseConfigured && !currentResult) {
    return <SellerProfileSkeleton />;
  }

  const notFound = invalidUsername || currentResult?.status === 'not-found';
  const unavailable = !invalidUsername && (!isSupabaseConfigured || currentResult?.status === 'error');

  if (notFound || unavailable) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] text-[#0F172A] flex flex-col font-sans">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <SearchX className="h-10 w-10 text-[#E53935]" />
            </div>
            <h1 className="mb-3 text-2xl font-black tracking-tight">
              {unavailable ? 'Profile temporarily unavailable' : 'Seller not found'}
            </h1>
            <p className="mb-8 text-sm leading-relaxed text-slate-500">
              {unavailable
                ? 'We could not load this seller profile right now. Please try again later.'
                : 'This seller profile doesn’t exist or isn’t publicly available.'}
            </p>
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E53935] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-200 transition-colors hover:bg-[#D32F2F]"
            >
              Browse Ads <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) return null;

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#F6F8FB] font-sans text-[#0F172A]">
      <Header />
      <main className="py-6 sm:py-8">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:mb-8 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center sm:gap-6">
                <div className="relative shrink-0">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`${profile.display_name}'s profile`}
                      width={96}
                      height={96}
                      className="h-20 w-20 rounded-2xl object-cover shadow-md sm:h-24 sm:w-24"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#E53935] text-3xl font-black text-white shadow-md sm:h-24 sm:w-24 sm:text-4xl">
                      {(profile.display_name || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {profile.phone_verified && (
                    <span
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white"
                      title="Phone verified"
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="break-words text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">
                      {profile.display_name}
                    </h1>
                    {profile.phone_verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> Phone Verified
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0 text-[#E53935]" />
                      <span className="break-words">{profile.location_text || 'Location not specified'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                      Member since {memberSince}
                    </span>
                  </div>

                  {profile.bio && (
                    <p className="mt-3 max-w-3xl break-words text-sm leading-relaxed text-slate-600">
                      {profile.bio}
                    </p>
                  )}
                  {business?.verification_status === 'verified' && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                      Verified Business{business.business_category ? ` · ${business.business_category}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[190px] sm:flex-row">
                <button
                  type="button"
                  onClick={() => void shareProfile()}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-[#E53935] hover:text-[#E53935]"
                >
                  <Share2 className="h-4 w-4" /> Share Profile
                </button>
                <Link
                  href={`/dashboard/messages?seller=${encodeURIComponent(profile.username)}`}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E53935] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#D32F2F]"
                >
                  <MessageSquare className="h-4 w-4" /> Contact Seller
                </Link>
              </div>
            </div>
            {shareMessage && (
              <p role="status" className="mt-3 text-right text-xs font-medium text-slate-500">
                {shareMessage}
              </p>
            )}
          </section>

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
            <section className="min-w-0">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-tight sm:text-2xl">
                    Active Listings ({ads.length})
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {ads.length ? 'Browse this seller’s current listings.' : 'This seller has no active listings at the moment.'}
                  </p>
                </div>
              </div>

              {ads.length > 0 && (
                <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                  <label className="relative min-w-0 flex-1">
                    <span className="sr-only">Search listings</span>
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search listings..."
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
                    />
                  </label>
                  <label className="min-w-0 sm:w-44">
                    <span className="sr-only">Sort listings</span>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
                    >
                      <option value="newest">Newest First</option>
                      <option value="price_low">Price: Low to High</option>
                      <option value="price_high">Price: High to Low</option>
                      <option value="popular">Most Popular</option>
                    </select>
                  </label>
                  <label className="min-w-0 sm:w-48">
                    <span className="sr-only">Filter by category</span>
                    <select
                      value={selectedCategory}
                      onChange={(event) => setSelectedCategory(event.target.value)}
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
                    >
                      {uniqueCategories.map((category) => (
                        <option key={category} value={category}>
                          {category === 'All' ? 'All Categories' : category}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {filteredAds.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white px-5 py-12 text-center shadow-sm">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <SearchX className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-bold">
                    {ads.length ? 'No matching listings' : 'No active listings'}
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    {ads.length
                      ? 'Try another search or category filter.'
                      : 'Check back later to see this seller’s new listings.'}
                  </p>
                  {ads.length > 0 && (searchQuery || selectedCategory !== 'All') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                      }}
                      className="mt-4 rounded-lg px-3 py-2 text-sm font-bold text-[#E53935] hover:bg-red-50"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3">
                  {filteredAds.map((ad) => (
                    <div key={ad.id} className="min-w-0">
                      <ListingCard
                        wholeCardLink
                        showFavorite={false}
                        showCondition={ad.condition !== null}
                        listing={{
                          id: ad.id,
                          slug: ad.slug,
                          title: ad.title,
                          description: '',
                          price: ad.price,
                          currency: 'INR',
                          images: ad.images.map((image) => image.url),
                          category: ad.category_name,
                          categorySlug: ad.category_slug,
                          country: '',
                          countrySlug: '',
                          state: '',
                          stateSlug: '',
                          city: '',
                          citySlug: '',
                          location: ad.location_name,
                          locationSlug: '',
                          postedAt: new Date(ad.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          }),
                          condition: ad.condition ?? 'used_good',
                          featured: false,
                          promoted: false,
                          verified: false,
                          views: ad.views_count,
                          favorites: ad.favorites_count,
                          contactEmail: '',
                          seller: {
                            name: profile.display_name,
                            verified: profile.phone_verified,
                            joinedAt: profile.created_at,
                            email: '',
                          },
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <aside className="min-w-0">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
                <h2 className="text-lg font-black tracking-tight">About this seller</h2>
                <dl className="mt-5 space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#E53935]" />
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-slate-400">Location</dt>
                      <dd className="mt-0.5 break-words font-semibold text-slate-800">
                        {profile.location_text || 'Not specified'}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <dt className="text-xs font-medium text-slate-400">Member since</dt>
                      <dd className="mt-0.5 font-semibold text-slate-800">{memberSince}</dd>
                    </div>
                  </div>
                  {profile.phone_verified && (
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <dd className="font-semibold text-emerald-700">Phone verified</dd>
                    </div>
                  )}
                  {business?.verification_status === 'verified' && (
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <dd className="break-words font-semibold text-emerald-700">
                        Verified Business{business.business_category ? ` · ${business.business_category}` : ''}
                      </dd>
                    </div>
                  )}
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    setReportOpen(true);
                    setReportError('');
                  }}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E53935] px-4 py-2.5 text-sm font-bold text-[#E53935] transition-colors hover:bg-red-50"
                >
                  <Flag className="h-4 w-4" /> Report Seller
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />

      {reportOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reportSending) resetReport();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-report-title"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="seller-report-title" className="text-lg font-black">Report this seller</h2>
                <p className="mt-1 text-sm text-slate-500">Choose the reason that best describes your concern.</p>
              </div>
              <button
                type="button"
                onClick={resetReport}
                disabled={reportSending}
                aria-label="Close report dialog"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {reportSubmitted ? (
              <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                Report submitted. Our moderation team will review it.
              </p>
            ) : reportRequiresLogin ? (
              <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                Sign in to submit a report.
                <Link
                  href={`/login?next=${encodeURIComponent(`/seller/${profile.username}`)}`}
                  className="ml-2 font-bold underline"
                >
                  Log in
                </Link>
              </div>
            ) : (
              <form onSubmit={(event) => void submitReport(event)} className="mt-5 space-y-4">
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-bold text-slate-700">Reason</legend>
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                        reportReason === reason
                          ? 'border-red-200 bg-red-50 font-semibold text-[#C62828]'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="seller-report-reason"
                        value={reason}
                        checked={reportReason === reason}
                        onChange={() => setReportReason(reason)}
                        className="accent-[#E53935]"
                      />
                      {reason}
                    </label>
                  ))}
                </fieldset>
                <label className="block text-sm font-bold text-slate-700">
                  Additional details <span className="font-normal text-slate-400">(optional)</span>
                  <textarea
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                  />
                </label>
                {reportError && <p role="alert" className="text-sm font-medium text-red-700">{reportError}</p>}
                <button
                  type="submit"
                  disabled={!reportReason || reportSending}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#E53935] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#D32F2F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reportSending ? 'Submitting…' : 'Submit report'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SellerProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[#F6F8FB] font-sans">
      <Header />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="h-40 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm" />
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
