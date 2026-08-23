'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ShieldCheck, Lock, CreditCard } from 'lucide-react';

const PROMO_CATALOG: Record<string, { name: string; price: number }> = {
  boost: { name: 'Boost 3 Days', price: 49 },
  featured: { name: 'Featured 7 Days', price: 99 },
  top: { name: 'Top Listing', price: 199 },
};

export default function CheckoutView({ initialOrderId }: { initialOrderId?: string }) {
  const searchParams = useSearchParams();
  const orderId = initialOrderId || searchParams.get('order') || 'FND-ORD-9001';

  // Deterministic mock order derived from the order id
  const order = useMemo(() => {
    const promoKeys = Object.keys(PROMO_CATALOG);
    const idx = Math.abs(orderId.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % promoKeys.length;
    const promo = PROMO_CATALOG[promoKeys[idx]];
    return {
      adTitle: 'Luxury 3 BHK Apartment with Modern Interior',
      promo,
      gst: Math.round(promo.price * 0.18),
      fee: 2,
    };
  }, [orderId]);

  const total = order.promo.price + order.gst + order.fee;
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const pay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setDone(true);
      setTimeout(() => (window.location.href = '/payment/success'), 1200);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Checkout' }]} />

          <div className="text-center mb-8 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-mono font-bold text-slate-500">
              ORDER {orderId}
            </span>
            <h1 className="text-3xl font-black tracking-tight mt-3">Secure Checkout</h1>
            <p className="text-sm text-slate-500 mt-1.5">Complete your promotion purchase below.</p>
          </div>

          {/* Order summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-6">
            <h2 className="font-bold mb-5 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#E53935]" /> Order Summary
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Advertisement</dt><dd className="font-semibold text-right max-w-[240px] truncate">{order.adTitle}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Promotion</dt><dd className="font-semibold">{order.promo.name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Promotion price</dt><dd className="font-semibold">₹{order.promo.price}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">GST (18%)</dt><dd className="font-semibold">₹{order.gst}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Platform fee</dt><dd className="font-semibold">₹{order.fee}</dd></div>
              <div className="flex justify-between pt-4 border-t border-slate-100 text-lg">
                <dt className="font-black">Total Payable</dt>
                <dd className="font-black text-[#E53935]">₹{total}</dd>
              </div>
            </dl>

            {/* Taxes / fees note */}
            <p className="text-[11px] text-slate-400 leading-relaxed mt-4 p-3 bg-slate-50 rounded-xl">
              Taxes and fees are calculated as per Indian digital services regulations. You will receive a GST
              invoice by email after a successful payment.
            </p>
          </div>

          {/* Mock payment method */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
            <h2 className="font-bold mb-5">Payment Method</h2>
            <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-[#E53935] bg-red-50/50 cursor-pointer">
              <input type="radio" name="pay-method" defaultChecked className="accent-[#E53935]" />
              <Lock className="w-4 h-4 text-[#E53935]" />
              <span className="text-sm font-bold">UPI / Card / NetBanking (Demo Gateway)</span>
            </label>

            <button
              onClick={pay}
              disabled={processing || done}
              className="mt-6 w-full py-4 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-base font-bold transition-colors shadow-lg shadow-red-200"
            >
              {processing ? (
                <>
                  <svg className="animate-spin w-5 h-5 inline mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing payment...
                </>
              ) : done ? (
                'Payment approved! Redirecting...'
              ) : (
                `Pay ₹${total} Securely`
              )}
            </button>

            <p className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              256-bit encrypted · Frontend demo only — no real charge will be made.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}