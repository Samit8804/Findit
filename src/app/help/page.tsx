'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SupportHero } from '@/components/pages/StaticShell';
import { Search, ChevronRight, BookOpen, ShieldCheck, CreditCard, Layers, User } from 'lucide-react';

const CATEGORIES = [
  { icon: BookOpen, title: 'Getting Started', desc: 'Account setup, posting your first ad and profile basics.', count: 12 },
  { icon: Layers, title: 'Buying & Selling', desc: 'Search tips, messaging sellers, closing deals safely.', count: 18 },
  { icon: CreditCard, title: 'Payments & Promotions', desc: 'Boosts, featured listings, refunds and invoices.', count: 9 },
  { icon: ShieldCheck, title: 'Trust & Safety', desc: 'Verification, reporting ads and scam prevention.', count: 11 },
  { icon: User, title: 'Account & Profile', desc: 'Login issues, changing email, deleting your account.', count: 8 },
];

const POPULAR = [
  'How do I post an ad for free?',
  'Why is my listing pending review?',
  'How do promotions (Featured / TOP) work?',
  'I never received a verification email',
  'How do I report a suspicious seller?',
  'Can I edit or delete my ad after posting?',
];

export default function HelpPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <SupportHero
        title="Help Center"
        subtitle="Find answers about accounts, posting, payments and safety — or reach our support team."
      />

      <main className="flex-grow py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search */}
          <div className="relative mb-10">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help articles..."
              aria-label="Search help articles"
              className="w-full pl-13 pr-4 py-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm font-medium focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
            />
          </div>

          {/* Categories */}
          <h2 className="text-lg font-bold mb-5">Browse by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {CATEGORIES.map((c) => (
              <Link
                key={c.title}
                href={`/help?category=${encodeURIComponent(c.title)}`}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all p-5 flex items-start gap-4"
              >
                <span className="w-11 h-11 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center shrink-0 group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                  <c.icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-grow">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">{c.title}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#E53935] transition-colors shrink-0" />
                  </span>
                  <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{c.desc}</span>
                  <span className="block text-[11px] font-semibold text-slate-400 mt-2">{c.count} articles</span>
                </span>
              </Link>
            ))}
          </div>

          {/* Popular questions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
            <h2 className="text-lg font-bold mb-5">Popular Questions</h2>
            <ul className="divide-y divide-slate-100">
              {(query ? POPULAR.filter((q) => q.toLowerCase().includes(query.toLowerCase())) : POPULAR).map((q) => (
                <li key={q}>
                  <Link href="/contact" className="group flex items-center justify-between gap-3 py-3.5 text-sm font-semibold text-slate-600 hover:text-[#E53935] transition-colors">
                    {q}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#E53935] shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
            {query && POPULAR.every((q) => !q.toLowerCase().includes(query.toLowerCase())) && (
              <p className="text-sm text-slate-400 py-6 text-center">
                No articles match &ldquo;{query}&rdquo;. Try the{' '}
                <Link href="/contact" className="text-[#E53935] font-semibold hover:underline">contact form</Link> instead.
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}