import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sparkles, Rocket, Crown, Building2, Check, BadgeCheck } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'FREE',
    price: '₹0',
    period: '',
    tagline: 'Perfect to get started',
    icon: Sparkles,
    highlight: false,
    cta: 'Post Free Ad',
    href: '/post-ad',
    features: ['30 days visibility', 'Up to 8 photos', 'Standard search ranking', 'Email & chat contact'],
  },
  {
    id: 'featured',
    name: 'FEATURED',
    price: '₹99',
    period: 'per ad',
    tagline: '3x more views',
    icon: Rocket,
    highlight: true,
    cta: 'Go Featured',
    href: '/post-ad',
    features: [
      'Everything in FREE',
      'Featured badge on your ad',
      'Top of category results · 7 days',
      'Highlighted in search results',
      'Priority moderation queue',
    ],
  },
  {
    id: 'top',
    name: 'TOP',
    price: '₹199',
    period: 'per ad',
    tagline: 'Maximum reach',
    icon: Crown,
    highlight: false,
    cta: 'Go TOP',
    href: '/post-ad',
    features: [
      'Everything in FEATURED',
      'Homepage spotlight placement',
      'TOP AD badge + gold border',
      'Priority ranking · 30 days',
      'Social media shoutout',
    ],
  },
  {
    id: 'business',
    name: 'BUSINESS',
    price: '₹499',
    period: '/month',
    tagline: 'For growing shops',
    icon: Building2,
    highlight: false,
    cta: 'Start Business',
    href: '/register',
    features: [
      'Business directory profile',
      'Verified business badge',
      '10 featured ads / month',
      'Reviews & rating management',
      'Basic analytics dashboard',
    ],
  },
  {
    id: 'business-pro',
    name: 'BUSINESS PRO',
    price: '₹999',
    period: '/month',
    tagline: 'Scale like a pro',
    icon: BadgeCheck,
    highlight: false,
    cta: 'Start Pro Trial',
    href: '/register',
    features: [
      'Everything in BUSINESS',
      'Unlimited featured ads',
      'Homepage banner rotation',
      'Advanced performance analytics',
      'Dedicated account manager',
    ],
  },
];

export default function PricingPage() {
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

          {/* Plans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 items-stretch">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all ${
                    plan.highlight
                      ? 'border-[#E53935] bg-gradient-to-b from-white to-red-50/50 shadow-xl shadow-red-100 lg:-translate-y-2'
                      : 'border-slate-100 bg-white shadow-sm hover:shadow-md'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#E53935] text-white text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                      Recommended
                    </span>
                  )}

                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${plan.highlight ? 'bg-[#E53935] text-white' : 'bg-red-50 text-[#E53935]'}`}>
                    <Icon className="w-5 h-5" />
                  </span>

                  <h2 className="text-xs font-black tracking-widest">{plan.name}</h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black">{plan.price}</span>
                    {plan.period && <span className="text-xs text-slate-400 font-semibold">{plan.period}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{plan.tagline}</p>

                  <ul className="mt-5 space-y-2.5 pt-5 border-t border-slate-100 flex-grow">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`mt-6 block w-full text-center py-3 rounded-xl text-sm font-bold transition-colors ${
                      plan.highlight
                        ? 'bg-[#E53935] hover:bg-[#D32F2F] text-white shadow-lg shadow-red-200'
                        : 'border border-slate-200 hover:border-[#E53935] hover:text-[#E53935]'
                    }`}
                  >
                    {plan.cta}
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