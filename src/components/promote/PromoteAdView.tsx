'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Rocket, Check, ShieldCheck } from 'lucide-react';
import { mockListings } from '@/data/mockData';
import { demoAds } from '@/data/accountData';

const PROMOS = [
  { id: 'boost', name: 'Boost 3 Days', price: 49, desc: 'Small visibility bump at the top of your category for 3 days.', icon: '🚀' },
  { id: 'featured', name: 'Featured 7 Days', price: 99, desc: 'Featured badge + priority placement in search and categories.', icon: '⭐' },
  { id: 'top', name: 'Top Listing', price: 199, desc: 'Homepage spotlight, TOP badge and highest ranking for 30 days.', icon: '👑' },
] as const;

type PromoId = (typeof PROMOS)[number]['id'];

export default function PromoteAdView({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adId = initialId || searchParams.get('id') || 'demo-1';

  const listing = useMemo(() => {
    const l = mockListings.find((m) => m.id === adId);
    if (l) return { title: l.title, image: l.images[0], price: l.price };
    const d = demoAds.find((m) => m.id === adId);
    if (d) return { title: d.title, image: d.image, price: d.price };
    return { title: 'Your Advertisement', image: '', price: 0 };
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
                  ₹{listing.price.toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">ID: {adId.toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Promotion options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" role="radiogroup" aria-label="Promotion options">
            {PROMOS.map((p) => {
              const active = selected === p.id;
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
                  <span className="text-2xl">{p.icon}</span>
                  <h3 className="font-black text-sm tracking-wide mt-3">{p.name}</h3>
                  <p className="text-2xl font-black text-[#E53935] mt-1.5">₹{p.price}</p>
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
              <div className="flex justify-between"><dt className="text-slate-500">Promotion price</dt><dd className="font-semibold">{promo ? `₹${promo.price}` : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">GST (18%)</dt><dd className="font-semibold">{promo ? `₹${Math.round(promo.price * 0.18)}` : '—'}</dd></div>
              <div className="flex justify-between pt-3 border-t border-slate-100 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-black text-[#E53935]">{promo ? `₹${Math.round(promo.price * 1.18)}` : '—'}</dd>
              </div>
            </dl>

            <button
              onClick={() => router.push(`/payment?order=FND-${Date.now().toString(36).toUpperCase()}`)}
              disabled={!promo}
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