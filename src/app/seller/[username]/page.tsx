'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShieldCheck, MapPin, Calendar, Zap, ArrowRight, SearchX } from 'lucide-react';
import { getPublicSellerByUsername, getSellerAds, getSellerBusiness, SellerWithAds } from '@/services/seller';
import { getUsernameValidationError } from '@/lib/username';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { formatINR } from '@/lib/format';
import { getAdUrl } from '@/lib/adUrl';

type SellerBusiness = Awaited<ReturnType<typeof getSellerBusiness>>;
type SellerPageResult =
  | { username: string; status: 'not-found' | 'error' }
  | { username: string; status: 'loaded'; seller: SellerWithAds; business: SellerBusiness };

function SellerProfileContent() {
  const params = useParams<{ username: string }>();
  const username = params.username.toLowerCase();
  const invalidUsername = !!getUsernameValidationError(username);
  const [result, setResult] = useState<SellerPageResult | null>(null);
  const currentResult = result?.username === username ? result : null;

  useEffect(() => {
    if (invalidUsername || !isSupabaseConfigured) return;
    
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
      } catch {
        if (!cancelled) {
          console.error('Failed to load public seller page.');
          setResult({ username, status: 'error' });
        }
      }
    };
    
    fetchSeller();
    
    return () => { cancelled = true; };
  }, [invalidUsername, username]);

  if (!invalidUsername && isSupabaseConfigured && !currentResult) {
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
                : 'This seller profile doesn&apos;t exist or isn&apos;t publicly available.'}
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

  if (!currentResult || currentResult.status !== 'loaded') return null;

  const { profile, ads } = currentResult.seller;
  const business = currentResult.business;
  const formattedJoined = new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const primaryImage = profile.avatar_url || null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Seller header */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              {/* Avatar */}
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

              {/* Profile info */}
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
                </div>

                <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {profile.location_text || 'Location not specified'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Member since {formattedJoined}
                  </span>
                  {profile.account_type === 'business' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
                      <Zap className="w-3 h-3" /> Business Account
                    </span>
                  )}
                </p>

                {business && business.verification_status === 'verified' && (
                  <p className="text-sm text-emerald-600 flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified Business — {business.business_category}
                  </p>
                )}

                {profile.bio && (
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed line-clamp-3">{profile.bio}</p>
                )}
              </div>
            </div>
          </div>

          {/* Seller ads */}
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl font-bold">{ads.length === 0 ? 'No active listings' : `Active Listings (${ads.length})`}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {ads.length === 0 
                    ? 'This seller has no active listings at the moment.' 
                    : 'Browse their active listings below.'}
                </p>
              </div>
            </div>

            {ads.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-14 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-5">
                  <SearchX className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold mb-1.5">No active listings</h3>
                <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
                  This seller doesn&apos;t have any active listings at the moment. Check back later!
                </p>
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold rounded-xl shadow-lg shadow-red-200 transition-colors"
                >
                  Browse All Ads <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {ads.map((ad) => (
                  <Link key={ad.id} href={getAdUrl(ad.slug)} className="block">
                    <div className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                        {ad.images.length > 0 ? (
                          <img
                            src={ad.images[0]?.url}
                            alt={ad.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <SearchX className="w-12 h-12 text-slate-300" />
                          </div>
                        )}
                        {ad.status === 'sold' && (
                          <span className="absolute top-3 left-3 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                            SOLD
                          </span>
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-grow">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xl font-bold text-[#0F172A]">
                            {formatINR(ad.price)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-[#0F172A] hover:text-[#E53935] transition-colors line-clamp-2 text-sm leading-snug mb-2">
                          {ad.title}
                        </h3>
                        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1 truncate max-w-[140px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {ad.location_name}
                          </span>
                          <span className="font-medium text-slate-400">
                            {new Date(ad.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
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