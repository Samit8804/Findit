'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sparkles, Rocket, Crown, Building2, Check, BadgeCheck } from 'lucide-react';
import { getActivePromotions } from '@/services/payments';

const FEATURE_TEXT: Record<string, { name: string; icon: React.ElementType; highlight?: boolean; cta: string; href: string; features: string[] }> = {
  boost: {
    name: 'BOOST', icon: Sparkles, cta: 'Boost Now', href: '/post-ad',
    features: ['Category top slot · 3 days', 'Small visibility lift', 'Standard support'],
  },
  'featured-ad': {
    name: 'FEATURED', icon: Rocket, highlight: true, cta: 'Go Featured', href: '/post-ad',
    features: ['Featured badge on your ad', 'Top of category results · 7 days', 'Highlighted in search results', 'Priority moderation queue'],
  },
  'top-listing': {
    name: 'TOP', icon: Crown, cta: 'Go TOP', href: '/post-ad',
    features: ['Homepage spotlight placement', 'TOP AD badge + gold border', 'Priority ranking · 30 days', 'Social media shoutout'],
  },
  'business-basic': {
    name: 'BUSINESS', icon: Building2, cta: 'Start Business', href: '/register',
    features: ['Business directory profile', 'Verified business badge', '10 featured ads / month', 'Basic analytics dashboard'],
  },
  'business-pro': {
    name: 'BUSINESS PRO', icon: BadgeCheck, cta: 'Start Pro Trial', href: '/register',
    features: ['Everything in BUSINESS', 'Unlimited featured ads', 'Homepage banner rotation', 'Dedicated account manager'],
  },
};

const ORDER = ['boost', 'featured-ad', 'top-listing', 'business-basic', 'business-pro'];

export default function PricingPage() {
  const [promos, setPromos] = useState<Awaited<ReturnType<typeof getActivePromotions>>>([]);

  useEffect(() => {
    getActivePromotions().then(setPromos);
  }, []);

  const plans = promos
    .slice()
    .sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Headline */}
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 text-[#E53935] text-xs font-bold tracking-wide uppercase mb-4">
              <Sparkles className="w-4 h-4" /> Monetization Plans
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto">
              Get More Visibility For Your Advertisement
            </h1>
            <p className="text-sm sm:text-base text-slate-500 max-w-xl mx-auto mt-4 leading-relaxed">
              Reach thousands of active buyers every day. Choose a plan that fits your goals — upgrade or cancel anytime.
            </p>
          </div>

          {/* Plans — prices come from the promotions table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 items-stretch">
            {plans.map((promo) => {
              const meta = FEATURE_TEXT[promo.slug] ?? {
                name: promo.name, icon: Sparkles, highlight: false,
                cta: 'Choose Plan', href: '/post-ad',
                features: promo.description ? [promo.description] : ['Promote your advertisement'],
              };
              const Icon = meta.icon;
              return (
                <div
                  key={promo.id}
                  className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all ${
                    meta.highlight
                      ? 'border-[#E53935] bg-gradient-to-b from-white to-red-50/50 shadow-xl shadow-red-100 lg:-translate-y-2'
                      : 'border-slate-100 bg-white shadow-sm hover:shadow-md'
                  }`}
                >
                  {meta.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#E53935] text-white text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                      Recommended
                    </span>
                  )}

                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${meta.highlight ? 'bg-[#E53935] text-white' : 'bg-red-50 text-[#E53935]'}`}>
                    <Icon className="w-5 h-5" />
                  </span>

                  <h2 className="text-xs font-black tracking-widest">{meta.name}</h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black">₹{Number(promo.price).toLocaleString('en-IN')}</span>
                    <span className="text-xs text-slate-400 font-semibold">{promo.durationDays ? `/ ${promo.durationDays} days` : '/month'}</span>
                  </div>

                  <ul className="mt-4 space-y-2.5 pt-4 border-t border-slate-100 flex-grow">
                    {meta.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={meta.href}
                    className={`mt-6 block w-full text-center py-3 rounded-xl text-sm font-bold transition-colors ${
                      meta.highlight
                        ? 'bg-[#E53935] hover:bg-[#D32F2F] text-white shadow-lg shadow-red-200'
                        : 'border border-slate-200 hover:border-[#E53935] hover:text-[#E53935]'
                    }`}
                  >
                    {meta.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Fine print */}
          <p className="text-center text-xs text-slate-400 mt-12 max-w-lg mx-auto leading-relaxed">
            All prices include GST. Promotions start as soon as payment is confirmed and run for the stated duration.
            Need a custom package for enterprise volume? Contact our sales team.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}