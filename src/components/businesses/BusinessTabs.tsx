'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Check } from 'lucide-react';
import { Business } from '@/data/businessData';

const TABS = ['About', 'Services', 'Products', 'Advertisements', 'Reviews', 'Contact'] as const;
type Tab = (typeof TABS)[number];

export function BusinessTabs({ business: b }: { business: Business }) {
  const [tab, setTab] = useState<Tab>('About');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-slate-100 px-2" role="tablist" aria-label="Business sections">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`relative shrink-0 px-5 py-4 text-sm font-bold transition-colors ${
              tab === t ? 'text-[#E53935]' : 'text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            {t}
            {tab === t && (
              <motion.span layoutId="biz-tab-underline" className="absolute left-3 right-3 -bottom-px h-0.5 bg-[#E53935] rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="p-6 sm:p-8 min-h-[300px]">
        {tab === 'About' && (
          <div>
            <h3 className="font-bold mb-3">About {b.name}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{b.longDescription}</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><dt className="text-slate-500">Category</dt><dd className="font-semibold">{b.category}</dd></div>
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><dt className="text-slate-500">Rating</dt><dd className="font-semibold">{b.rating} / 5 ({b.reviewCount} reviews)</dd></div>
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><dt className="text-slate-500">Location</dt><dd className="font-semibold">{b.location}</dd></div>
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><dt className="text-slate-500">Website</dt><dd className="font-semibold text-[#E53935]">{b.website}</dd></div>
            </dl>
          </div>
        )}

        {tab === 'Services' && (
          <ul className="space-y-4">
            {b.services.map((s) => (
              <li key={s.name} className="flex items-start justify-between gap-4 p-5 bg-slate-50 rounded-2xl">
                <div>
                  <p className="font-bold text-sm">{s.name}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.description}</p>
                </div>
                <span className="shrink-0 px-3 py-1 rounded-full bg-red-50 text-[#E53935] text-xs font-bold">{s.price}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'Products' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {b.products.map((p) => (
              <div key={p.name} className="rounded-2xl border border-slate-100 overflow-hidden group hover:shadow-md transition-shadow">
                <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <p className="text-sm font-bold line-clamp-1">{p.name}</p>
                  <p className="text-lg font-black text-[#E53935] mt-0.5">{p.price}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Advertisements' && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm font-semibold">No active advertisements right now.</p>
            <p className="text-xs text-slate-400 mt-1">Listings posted by {b.name} will appear here.</p>
          </div>
        )}

        {tab === 'Reviews' && (
          <ul className="space-y-5">
            {b.reviews.map((r) => (
              <li key={r.author + r.date} className="p-5 bg-slate-50 rounded-2xl">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center text-xs font-black">{r.author.charAt(0)}</span>
                    <div>
                      <p className="text-sm font-bold">{r.author}</p>
                      <p className="text-[11px] text-slate-400">{r.date}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-0.5" aria-label={`${r.rating} stars`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{r.text}</p>
              </li>
            ))}
          </ul>
        )}

        {tab === 'Contact' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><span className="text-slate-500">Phone</span><span className="font-semibold">{b.phone}</span></div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><span className="text-slate-500">WhatsApp</span><span className="font-semibold">{b.whatsapp}</span></div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><span className="text-slate-500">Website</span><span className="font-semibold text-[#E53935]">{b.website}</span></div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><span className="text-slate-500">Address</span><span className="font-semibold">{b.location}</span></div>
            <div className="sm:col-span-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-4">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-2">Business Hours</p>
              {b.hours.map((h) => (
                <p key={h.days} className="text-xs text-emerald-700 flex justify-between max-w-xs">
                  <span>{h.days}</span> <span>{h.time}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VerifiedTick() {
  return <Check className="w-4 h-4 text-emerald-500" />;
}