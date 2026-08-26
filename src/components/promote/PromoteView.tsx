'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Rocket, Check, ShieldCheck, Loader2 } from 'lucide-react';
import {
  getActivePromotions,
  Promotion,
} from '@/services/payments';
import { createOrderApi, openRazorpayCheckout } from '@/lib/payments/checkout';
import { isSupabaseConfigured, getSupabaseBrowser } from '@/lib/supabase/client';
import { mockListings } from '@/data/mockData';
import { demoAds } from '@/data/accountData';

export default function PromoteView({ initialId }: { initialId?: string }) {
  
  const searchParams = useSearchParams();
  const adId = initialId || searchParams.get('id') || 'demo-1';
  const router = useRouter();

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getActivePromotions().then((list) => {
      setPromos(list);
      setSelectedSlug(list.find((p) => p.slug === 'featured-ad')?.slug || list[0]?.slug || '');
    });
  }, []);

  const selected = useMemo(
    () => promos.find((p) => p.slug === selectedSlug),
    [promos, selectedSlug]
  );

  const listing = useMemo(() => {
    const l = mockListings.find((m) => m.id === adId);
    if (l) return { title: l.title, image: l.images[0], price: l.price };
    const d = demoAds.find((m) => m.id === adId);
    return d
      ? { title: d.title, image: d.image, price: d.price }
      : { title: 'Your Advertisement', image: '', price: 0 };
  }, [adId]);

  const continueToPayment = async () => {
    setError('');
    if (!selected) return;

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
          // Demo checkout page still works without keys
          router.push(`/payment?order=FND-${Date.now().toString(36).toUpperCase()}&promo=${selected.slug}`);
          return;
        }
        setError(e.detail || e.message || 'Unable to create order.');
        return;
      }
    }

    /* Demo mode */
    void openRazorpayCheckout; // tree-shake guard
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
            <p className="text-sm text-slate-500 mt-1">Get up to 10x more views with a visibility boost.</p>
          </div>

          {/* Current advertisement */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Current Advertisement</h2>
            <div className="flex items-center gap-4">
              {listing.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.image} alt="" className="w-20 h-16 rounded-xl object-cover bg-slate-100 shrink-0" />
              ) : (
                <span className="w-20 h-16 rounded-xl bg-slate-100 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm line-clamp-1">{listing.title}</p>
                <p className="text-lg font-black text-[#E53935] mt-0.5">â‚¹{listing.price.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-slate-400 font-mono">ID: {adId.slice(0, 12)}</p>
              </div>
            </div>
          </div>

          {/* Promotion options â€” prices come from the database */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" role="radiogroup" aria-label="Promotion options">
            {promos.length === 0 && (
              <div className="col-span-full p-6 text-center text-sm text-slate-400 animate-pulse">
                Loading promotion packagesâ€¦
              </div>
            )}
            {promos.map((p) => {
              const active = selectedSlug === p.slug;
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelectedSlug(p.slug)}
                  className={`relative text-left p-6 rounded-2xl border-2 transition-all ${
                    active ? 'border-[#E53935] bg-red-50/60 shadow-md shadow-red-100' : 'border-slate-100 bg-white hover:border-red-200'
                  }`}
                >
                  {active && (
                    <span className="absolute top-4 right-4 w-6 h-6 bg-[#E53935] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </span>
                  )}
                  <span className="text-2xl">{p.type === 'boost' ? 'ðŸš€' : p.type === 'top' ? 'ðŸ‘‘' : 'â­'}</span>
                  <h3 className="font-black text-sm tracking-wide mt-3">{p.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-2xl font-black text-[#E53935]">â‚¹{Number(p.price).toLocaleString('en-IN')}</p>
                    {p.durationDays && <span className="text-xs text-slate-400">/ {p.durationDays} days</span>}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">{p.description}</p>
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
              <div className="flex justify-between"><dt className="text-slate-500">Selected promotion</dt><dd className="font-semibold">{selected?.name ?? 'â€”'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Duration</dt><dd className="font-semibold">{selected?.durationDays ? `${selected.durationDays} days` : 'â€”'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Price</dt><dd className="font-semibold">{selected ? `â‚¹${Number(selected.price).toLocaleString('en-IN')}` : 'â€”'}</dd></div>
              <div className="flex justify-between pt-3 border-t border-slate-100 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-black text-[#E53935]">{selected ? `â‚¹${Number(selected.price).toLocaleString('en-IN')}` : 'â€”'}</dd>
              </div>
            </dl>

            <button
              onClick={continueToPayment}
              disabled={!selected || creating}
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
