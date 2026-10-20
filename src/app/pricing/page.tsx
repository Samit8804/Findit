'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  Sparkles,
  Rocket,
  Crown,
  Building2,
  Check,
  BadgeCheck,
  MessageSquare,
  Lock,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { getActivePromotions, Promotion } from '@/services/payments';
import { createOrderApi } from '@/lib/payments/checkout';
import { useMessagingAccess } from '@/lib/useMessagingAccess';
import { formatMessagingExpiry, isEligibleMessagingPlan } from '@/lib/messagingEntitlement';

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
    name: 'BUSINESS PRO', icon: BadgeCheck, cta: 'Start Pro', href: '/register',
    features: ['Everything in BUSINESS', 'Unlimited featured ads', 'Homepage banner rotation', 'Dedicated account manager'],
  },
};

const ORDER = ['boost', 'featured-ad', 'top-listing', 'business-basic', 'business-pro'];

export default function PricingPage() {
  const router = useRouter();
  const { access, loading: accessLoading } = useMessagingAccess();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getActivePromotions()
      .then(setPromos)
      .finally(() => setLoading(false));
  }, []);

  const plansBySlug = promos
    .filter((promo) => ORDER.includes(promo.slug))
    .reduce((bySlug, promo) => {
      if (!bySlug.has(promo.slug)) bySlug.set(promo.slug, promo);
      return bySlug;
    }, new Map<string, Promotion>());
  const plans = [...plansBySlug.values()]
    .sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));

  const buyBusinessPlan = async (promo: Promotion) => {
    setError('');
    setBuying(promo.id);
    try {
      const order = await createOrderApi(null, promo.slug);
      router.push(`/payment/${order.orderId}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'ORDER_CREATE_FAILED';
      if (message === 'NOT_AUTHENTICATED') {
        router.push(`/login?redirect=${encodeURIComponent('/pricing')}`);
        return;
      }
      if (message === 'GATEWAY_NOT_CONFIGURED' || message === 'BACKEND_NOT_CONFIGURED') {
        setError('Online payments are temporarily unavailable. No payment was taken.');
      } else {
        setError('We could not start checkout. Please try again in a moment.');
      }
      setBuying(null);
    }
  };

  const expiry = formatMessagingExpiry(access?.expiresAt);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 text-[#E53935] text-xs font-bold tracking-wide uppercase mb-4">
              <Sparkles className="w-4 h-4" /> Plans &amp; Promotions
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto">
              Get More Visibility For Your Advertisement
            </h1>
            <p className="text-sm sm:text-base text-slate-500 max-w-xl mx-auto mt-4 leading-relaxed">
              One-time plans with no auto-renewal. Choose the reach you need — messaging is
              included with every plan priced ₹149 or more.
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-10">
            {accessLoading ? (
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking your current plan…
              </div>
            ) : access?.allowed ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3.5 text-center">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-800">
                  {access.configured === false
                    ? 'Demo preview — messaging is simulated locally'
                    : `${access.planName || 'Messaging'} is active${expiry ? ` until ${expiry}` : ''}`}
                </p>
                {access.configured !== false && (
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Buying the same plan again extends it.
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-3.5 text-center">
                <Lock className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">
                  Messaging is not active on your account yet. Plans of ₹149+ include it.
                </p>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-[420px] rounded-2xl border border-slate-100 bg-white animate-pulse" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-100">
              <p className="text-sm font-semibold text-slate-600">Plans are temporarily unavailable.</p>
              <p className="text-xs text-slate-400 mt-1">Please try again later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 items-stretch">
              {plans.map((promo) => {
                const meta = FEATURE_TEXT[promo.slug] ?? {
                  name: promo.name, icon: Sparkles, highlight: false,
                  cta: 'Choose Plan', href: '/post-ad',
                  features: promo.description ? [promo.description] : ['Promote your advertisement'],
                };
                const Icon = meta.icon;
                const messagingIncluded = isEligibleMessagingPlan(promo);
                const isBusinessPlan = promo.type === 'business_subscription';
                const isCurrentPlan = access?.allowed && access.planName === promo.name;
                const isBuying = buying === promo.id;
                const ctaLabel = isBusinessPlan && isCurrentPlan ? 'Extend Plan' : meta.cta;

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
                      <span className="text-xs text-slate-400 font-semibold">{promo.durationDays ? `/ ${promo.durationDays} days` : ''}</span>
                    </div>

                    <div className={`mt-3 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      messagingIncluded
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {messagingIncluded ? (
                        <><MessageSquare className="w-3 h-3" /> Messaging included</>
                      ) : (
                        <><Lock className="w-3 h-3" /> Messaging not included</>
                      )}
                    </div>

                    <ul className="mt-4 space-y-2.5 pt-4 border-t border-slate-100 flex-grow">
                      {meta.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> {f}
                        </li>
                      ))}
                      {messagingIncluded && (
                        <li className="flex items-start gap-2 text-xs font-semibold text-slate-700 leading-relaxed">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          Direct buyer messaging for the plan duration
                        </li>
                      )}
                    </ul>

                    {isBusinessPlan ? (
                      <button
                        type="button"
                        onClick={() => void buyBusinessPlan(promo)}
                        disabled={buying !== null}
                        className={`mt-6 flex w-full items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
                          meta.highlight
                            ? 'bg-[#E53935] hover:bg-[#D32F2F] text-white shadow-lg shadow-red-200'
                            : 'border border-slate-200 hover:border-[#E53935] hover:text-[#E53935]'
                        }`}
                      >
                        {isBuying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        {isBuying ? 'Starting checkout…' : ctaLabel}
                      </button>
                    ) : (
                      <Link
                        href={meta.href}
                        className={`mt-6 flex w-full items-center justify-center py-3 rounded-xl text-sm font-bold transition-colors ${
                          meta.highlight
                            ? 'bg-[#E53935] hover:bg-[#D32F2F] text-white shadow-lg shadow-red-200'
                            : 'border border-slate-200 hover:border-[#E53935] hover:text-[#E53935]'
                        }`}
                      >
                        {ctaLabel}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-6 text-center text-sm font-semibold text-[#D32F2F]">
              {error}
            </p>
          )}

          <p className="text-center text-xs text-slate-400 mt-12 max-w-xl mx-auto leading-relaxed">
            All prices include GST. Plans start after payment is verified and run for the stated
            duration. Messaging activates only for eligible paid plans — never from a profile label.
            Need a custom package for enterprise volume? Contact our sales team.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
