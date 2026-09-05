'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Rocket, Star, Crown, Check, ShieldCheck, Loader2 } from 'lucide-react';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const PROMOS = [
  { id: 'boost', name: 'Boost 3 Days', price: 49, desc: 'Small visibility bump at the top of your category for 3 days.', icon: Rocket },
  { id: 'featured', name: 'Featured 7 Days', price: 99, desc: 'Featured badge + priority placement in search and categories.', icon: Star },
  { id: 'top', name: 'Top Listing', price: 199, desc: 'Homepage spotlight, TOP badge and highest ranking for 30 days.', icon: Crown },
] as const;

type PromoId = (typeof PROMOS)[number]['id'];

export default function PromoteAdView({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adId = initialId || searchParams.get('id') || '';

  const [listing, setListing] = useState<{ title: string; image: string; price: number } | null>(null);
  const [listingError, setListingError] = useState('');

  React.useEffect(() => {
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
        const { data, error } = await sb.from('ads').select('id, title, price, ad_images(image_url, is_primary, sort_order)').eq('id', adId).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) { setListingError('Advertisement not found.'); return; }
        const img = (data.ad_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0]?.image_url || '';
        setListing({ title: data.title, image: img, price: Number(data.price) || 0 });
      } catch (e: any) {
        setListingError(e.message || 'Unable to load advertisement.');
      }
    })();
  }, [adId]);

  const [selected, setSelected] = useState<PromoId | ''>('');
  const promo = PROMOS.find((p) => p.id === selected);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'My Ads', href: '/dashboard/my-ads' }, { label: 'Promote Ad' }]} />

          <div className="mb-8 mt-2">
            <h1 className="text-3xl font-black tracking-tight">Promote Your Ad</h1>
            <p className="text-sm text-slate-500 mt-1">Get up to 10x more views with a visibility boost.</p>
          </div>

          {/* Current advertisement preview */}
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
                  <div className="w-20 h-16 rounded-xl bg-slate-100 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm line-clamp-1">{listing.title}</p>
                  <p className="text-lg font-black text-[#E53935] mt-0.5">
                    {formatINR(listing.price)}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">ID: {adId.toUpperCase()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Promotion options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" role="radiogroup" aria-label="Promotion options">
            {PROMOS.map((p) => {
              const active = selected === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(p.id)}
                  className={`relative text-left p-6 rounded-2xl border-2 transition-all ${
                    active ? 'border-[#E53935] bg-red-50/60 shadow-md shadow-red-100' : 'border-slate-100 bg-white hover:border-red-200'
                  }`}
                >
                  {active && (
                    <span className="absolute top-4 right-4 w-6 h-6 bg-[#E53935] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </span>
                  )}
                  <span className="inline-flex w-10 h-10 rounded-xl bg-red-50 text-[#E53935] items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="font-black text-sm tracking-wide mt-3">{p.name}</h3>
                  <p className="text-2xl font-black text-[#E53935] mt-1.5">{formatINR(p.price)}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">{p.desc}</p>
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
              <div className="flex justify-between"><dt className="text-slate-500">Selected promotion</dt><dd className="font-semibold">{promo ? promo.name : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Promotion price</dt><dd className="font-semibold">{promo ? formatINR(promo.price) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">GST (18%)</dt><dd className="font-semibold">{promo ? formatINR(Math.round(promo.price * 0.18)) : '—'}</dd></div>
              <div className="flex justify-between pt-3 border-t border-slate-100 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-black text-[#E53935]">{promo ? formatINR(Math.round(promo.price * 1.18)) : '—'}</dd>
              </div>
            </dl>

            <button
              onClick={() => router.push(`/payment?order=FND-${Date.now().toString(36).toUpperCase()}`)}
              disabled={!promo || !!listingError}
              className="mt-7 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-lg shadow-red-200"
            >
              Continue to Payment
            </button>
            {!promo && <p className="text-xs text-slate-400 mt-3">Select a promotion package above to continue.</p>}
          </div>

          <p className="flex items-center gap-2 justify-center pt-6 pb-4 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Payments are simulated in this demo — no money is charged.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
