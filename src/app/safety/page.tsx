import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SupportHero } from '@/components/pages/StaticShell';
import { ShieldCheck, ShoppingBag, Tag, AlertTriangle, Flag } from 'lucide-react';

const SECTIONS = [
  {
    icon: ShoppingBag,
    title: 'Buying Safely',
    color: 'bg-emerald-50 text-emerald-600',
    tips: [
      'Inspect the item in person before paying whenever possible.',
      'Meet in busy public places — metro stations, malls, coffee shops.',
      'Check prices against similar listings; deals that look too good usually are.',
      'For vehicles, always verify registration papers and service history.',
      'Use cash or traceable digital payments and take a signed receipt.',
    ],
  },
  {
    icon: Tag,
    title: 'Selling Safely',
    color: 'bg-sky-50 text-sky-600',
    tips: [
      'Confirm payment has cleared in your account before handing over items.',
      'Beware of overpayment scams — never refund "accidental" extra transfers.',
      'Share your address only when the buyer is verified or on the way.',
      'Meet buyers accompanied for high-value items like cars and property.',
      'Keep chats on FindIt — moving to unknown apps is a common scam signal.',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Scam Prevention',
    color: 'bg-red-50 text-[#E53935]',
    tips: [
      'Never share OTPs, banking PINs or full card numbers with anyone.',
      'Ignore "courier holds" or "customs fees" asking for advance payment.',
      'Be cautious of sellers who refuse calls, video verification or meetups.',
      'Watch for copied photos — reverse image search suspicious listings.',
      'Urgency pressure ("pay now or lose it") is a classic manipulation tactic.',
    ],
  },
];

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <SupportHero
        title="Safety Center"
        subtitle="Millions of safe trades happen every month. A few simple habits keep it that way."
      />

      <main className="flex-grow py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Tip sections */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SECTIONS.map((s) => (
              <div key={s.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </span>
                <h2 className="font-black text-base mb-4">{s.title}</h2>
                <ul className="space-y-3">
                  {s.tips.map((t) => (
                    <li key={t} className="text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Report CTA */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0F172A] to-slate-900 p-8 sm:p-12 text-white shadow-2xl">
            <div className="max-w-xl space-y-4 relative z-10">
              <span className="px-3 py-1 rounded-full bg-red-500/20 text-[#ff8a87] text-xs font-bold tracking-wider uppercase inline-block">
                See something suspicious?
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Report a Listing</h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Every report is reviewed by our moderation team — usually within an hour. Reporting keeps
                FindIt trustworthy for everyone.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link href="/browse" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-lg shadow-red-900/30">
                  <Flag className="w-4 h-4" /> Browse &amp; Report Ads
                </Link>
                <Link href="/contact" className="inline-flex items-center px-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 text-white text-sm font-bold transition-colors">
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}