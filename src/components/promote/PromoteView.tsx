'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Rocket, Star, Crown, Clock, Check, ShieldCheck, Loader2, AlertCircle, Info } from 'lucide-react';
import {
  getActivePromotions,
  Promotion,
  checkBoostEligibility,
  checkExtensionEligibility,
  BoostEligibility,
  ExtensionEligibility,
} from '@/services/payments';
import { createOrderApi, openRazorpayCheckout } from '@/lib/payments/checkout';
import { isSupabaseConfigured, getSupabaseBrowser } from '@/lib/supabase/client';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const promoIcon = (type: string, planType?: string) => {
  if (planType === 'boost_3d' || type === 'boost') return Rocket;
  if (planType === 'extend_10d' || type === 'extension') return Clock;
  if (type === 'top') return Crown;
  if (type === 'business_subscription') return Star;
  return Star;
};

const promoColor = (planType?: string) => {
  if (planType === 'boost_3d') return 'bg-blue-50 text-blue-600';
  if (planType === 'extend_10d') return 'bg-amber-50 text-amber-600';
  if (planType === 'featured_7d') return 'bg-purple-50 text-purple-600';
  if (planType === 'top_30d') return 'bg-yellow-50 text-yellow-600';
  return 'bg-red-50 text-[#E53935]';
};

interface PlanEligibility {
  eligible: boolean;
  reason: string;
  remainingDays?: number;
  newExpiry?: string;
}

export default function PromoteView({ initialId }: { initialId?: string }) {
  const searchParams = useSearchParams();
  const adId = initialId || searchParams.get('id') || '';
  const router = useRouter();

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [listing, setListing] = useState<{ title: string; image: string; price: number } | null>(null);
  const [listingError, setListingError] = useState('');
  const [eligibility, setEligibility] = useState<Record<string, PlanEligibility>>({});

  useEffect(() => {
    getActivePromotions().then((list) => {
      setPromos(list);
      // Default to 10-day extension if available, else featured-ad, else first
      const defaultSlug = list.find((p) => p.slug === 'extend_10d')?.slug ||
        list.find((p) => p.slug === 'featured-ad')?.slug ||
        list[0]?.slug || '';
      setSelectedSlug(defaultSlug);
    });
  }, []);

  // Check eligibility for boost and extension plans when adId is available
  useEffect(() => {
    if (!adId || !isSupabaseConfigured) return;

    const checkAll = async () => {
      try {
        const results: Record<string, PlanEligibility> = {};

        // Check boost eligibility
        try {
          const boostResult = await checkBoostEligibility(adId);
          results['boost_3d'] = {
            eligible: boostResult.eligible,
            reason: boostResult.reason,
            remainingDays: boostResult.remainingDays,
          };
        } catch {
          results['boost_3d'] = { eligible: false, reason: 'Unable to check eligibility' };
        }

        // Check extension eligibility
        try {
          const extResult = await checkExtensionEligibility(adId);
          results['extend_10d'] = {
            eligible: extResult.eligible,
            reason: extResult.reason,
            newExpiry: extResult.newExpiry,
          };
        } catch {
          results['extend_10d'] = { eligible: false, reason: 'Unable to check eligibility' };
        }

        setEligibility(results);
      } catch {
        // Silently fail - eligibility is checked again server-side
      }
    };

    checkAll();
  }, [adId]);

  useEffect(() => {
    if (!adId) {
      setListingError('No advertisement selected.');
      return;
    }
    if (!isSupabaseConfigured) {
      setListingError('Unable to load advertisement — Supabase not configured.');
      return;
    }
    const sb = getSupabaseBrowser()!;
    (async () => {
      try {
        const { data, error } = await sb
          .from('ads')
          .select('id, title, price, expires_at, created_at, ad_images(image_url, is_primary, sort_order)')
          .eq('id', adId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) {
          setListingError('Advertisement not found.');
          return;
        }
        const img = (data.ad_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0]?.image_url || '';
        setListing({ title: data.title, image: img, price: Number(data.price) || 0 });
      } catch (e: any) {
        setListingError(e.message || 'Unable to load advertisement.');
      }
    })();
  }, [adId]);

  const selected = useMemo(
    () => promos.find((p) => p.slug === selectedSlug),
    [promos, selectedSlug]
  );

  const selectedEligibility = eligibility[selected?.planType || ''];

  const continueToPayment = async () => {
    setError('');
    if (!selected) return;
    if (!adId) {
      setError('No advertisement selected.');
      return;
    }

    // Check eligibility client-side for better UX (server will re-verify)
    if (selected.planType === 'boost_3d' && selectedEligibility && !selectedEligibility.eligible) {
      setError(selectedEligibility.reason);
      return;
    }
    if (selected.planType === 'extend_10d' && selectedEligibility && !selectedEligibility.eligible) {
      setError(selectedEligibility.reason);
      return;
    }

    /* Real gateway flow */
    if (isSupabaseConfigured) {
      setCreating(true);
      try {
        const order = await createOrderApi(adId, selected.slug);
        router.push(`/payment/${order.orderId}`);
        return;
      } catch (e: any) {
        setCreating(false);
        if (
          e.message === 'BACKEND_NOT_CONFIGURED' ||
          e.message === 'GATEWAY_NOT_CONFIGURED' ||
          e.message === 'NOT_AUTHENTICATED'
        ) {
          router.push(`/payment?order=FND-${Date.now().toString(36).toUpperCase()}&promo=${selected.slug}`);
          return;
        }
        // Handle specific eligibility errors from server
        if (e.message === 'BOOST_NOT_ELIGIBLE' || e.message === 'EXTENSION_NOT_ELIGIBLE') {
          setError(e.detail || e.message);
        } else {
          setError(e.detail || e.message || 'Unable to create order.');
        }
        return;
      }
    }

    /* Demo mode */
    void openRazorpayCheckout;
    router.push(`/payment?order=FND-${Date.now().toString(36).toUpperCase()}&promo=${selected.slug}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'My Ads', href: '/dashboard/my-ads' }, { label: 'Promote Ad' }]} />

          <div className="mb-8 mt-2">
            <h1 className="text-3xl font-black tracking-tight">Promote Your Ad</h1>
            <p className="text-sm text-slate-500 mt-1">Choose a plan to increase visibility or extend your listing duration.</p>
          </div>

          {/* Current advertisement */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Current Advertisement</h2>
            {listingError ? (
              <p className="text-sm text-[#D32F2F] font-medium">{listingError}</p>
            ) : !listing ? (
              <p className="text-sm text-slate-500 animate-pulse">Loading advertisement...</p>
            ) : (
              <div className="flex items-center gap-4">
                {listing.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.image} alt="" className="w-20 h-16 rounded-xl object-cover bg-slate-100 shrink-0" />
                ) : (
                  <span className="w-20 h-16 rounded-xl bg-slate-100 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm line-clamp-1">{listing.title}</p>
                  <p className="text-lg font-black text-[#E53935] mt-0.5">{formatINR(listing.price)}</p>
                  <p className="text-[11px] text-slate-400 font-mono">ID: {adId.slice(0, 12)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Promotion options — prices come from the database */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" role="radiogroup" aria-label="Promotion options">
            {promos.length === 0 && (
              <div className="col-span-full p-6 text-center text-sm text-slate-400 animate-pulse">
                Loading promotion packages...
              </div>
            )}
            {promos.map((p) => {
              const active = selectedSlug === p.slug;
              const Icon = promoIcon(p.type, p.planType);
              const colorClass = promoColor(p.planType);
              const planEligibility = eligibility[p.planType || ''];
              const isEligible = !planEligibility || planEligibility.eligible;
              const isBoostOrExtension = p.planType === 'boost_3d' || p.planType === 'extend_10d';

              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => isEligible && setSelectedSlug(p.slug)}
                  disabled={!isEligible && isBoostOrExtension}
                  className={`relative text-left p-6 rounded-2xl border-2 transition-all ${
                    active
                      ? 'border-[#E53935] bg-red-50/60 shadow-md shadow-red-100'
                      : !isEligible && isBoostOrExtension
                      ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'border-slate-100 bg-white hover:border-red-200'
                  }`}
                >
                  {active && (
                    <span className="absolute top-4 right-4 w-6 h-6 bg-[#E53935] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </span>
                  )}
                  {!isEligible && isBoostOrExtension && (
                    <span className="absolute top-4 right-4 w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-slate-500" />
                    </span>
                  )}
                  <span className={`inline-flex w-10 h-10 rounded-xl items-center justify-center ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="font-black text-sm tracking-wide mt-3">{p.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-2xl font-black text-[#E53935]">{formatINR(Number(p.price))}</p>
                    {p.durationDays && <span className="text-xs text-slate-400">/ {p.durationDays} days</span>}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">{p.description}</p>

                  {/* Eligibility message for Boost and Extension */}
                  {isBoostOrExtension && planEligibility && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      {planEligibility.eligible ? (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <Info className="w-3 h-3" /> Available
                        </p>
                      ) : (
                        <p className="text-xs text-[#D32F2F] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {planEligibility.reason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Plan type badge */}
                  <div className="mt-3 flex items-center gap-2">
                    {p.planType === 'boost_3d' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                        <Rocket className="w-3 h-3" /> 3-Day Visibility Boost
                      </span>
                    )}
                    {p.planType === 'extend_10d' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                        <Clock className="w-3 h-3" /> 10-Day Total Listing
                      </span>
                    )}
                    {p.planType === 'featured_7d' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
                        <Star className="w-3 h-3" /> 7-Day Featured
                      </span>
                    )}
                    {p.planType === 'top_30d' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-[10px] font-bold">
                        <Crown className="w-3 h-3" /> 30-Day Top Listing
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Order summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
            <h2 className="text-base font-bold mb-5 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#E53935]" /> Order Summary
            </h2>
            <dl className="space-y-3 text-sm max-w-md">
              <div className="flex justify-between"><dt className="text-slate-500">Selected promotion</dt><dd className="font-semibold">{selected?.name ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Duration</dt><dd className="font-semibold">{selected?.durationDays ? `${selected.durationDays} days` : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Price</dt><dd className="font-semibold">{selected ? formatINR(Number(selected.price)) : '—'}</dd></div>
              <div className="flex justify-between pt-3 border-t border-slate-100 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-black text-[#E53935]">{selected ? formatINR(Number(selected.price)) : '—'}</dd>
              </div>
            </dl>

            <button
              onClick={continueToPayment}
              disabled={!selected || creating || !!listingError || (selectedEligibility && !selectedEligibility.eligible && (selected?.planType === 'boost_3d' || selected?.planType === 'extend_10d'))}
              className="mt-7 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-lg shadow-red-200"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue to Payment
            </button>
            {error && <p role="alert" className="text-xs text-[#D32F2F] font-medium mt-3">{error}</p>}
          </div>

          <p className="flex items-center gap-2 justify-center pt-6 pb-4 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure payments powered by Razorpay. Prices are set by FindIt.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function initialOr(a: string | undefined, b: string | null, fallback: string): string {
  return a || b || fallback;
}

// keep imports referenced in demo-only paths
void getSupabaseBrowser;
