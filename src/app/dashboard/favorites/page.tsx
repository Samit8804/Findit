'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MapPin, Trash2, ArrowRight, HeartOff } from 'lucide-react';
import { favoriteListings } from '@/data/accountData';

export default function FavoritesPage() {
  const [items, setItems] = useState(favoriteListings);
  const [toast, setToast] = useState('');

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    flash('Removed from favorites.');
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Favorites</h1>
        <p className="text-xs text-slate-500 mt-1">Saved listings you want to keep an eye on.</p>
      </div>

      {items.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center p-14 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-[#E53935] mb-5">
            <HeartOff className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold mb-1.5">Nothing saved yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-7 leading-relaxed">
            Tap the heart on any listing and it will appear here so you can compare and decide later.
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold rounded-xl shadow-lg shadow-red-200 transition-colors"
          >
            Browse Ads <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow overflow-hidden group"
            >
              <Link href={item.href} className="block relative aspect-[16/10] overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </Link>

              <div className="p-5">
                <p className="text-xl font-black text-[#0F172A] mb-1">
                  ₹{item.price.toLocaleString('en-IN')}
                </p>
                <Link href={item.href}>
                  <h3 className="text-sm font-bold text-[#0F172A] line-clamp-2 leading-snug hover:text-[#E53935] transition-colors min-h-[2.5rem]">
                    {item.title}
                  </h3>
                </Link>

                <div className="mt-3 space-y-1.5 text-xs text-slate-500 pb-4 border-b border-slate-100">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {item.location}
                  </p>
                  <p className="text-slate-400">
                    Seller: <span className="font-semibold text-slate-600">{item.seller}</span>
                  </p>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2 pt-4">
                  <Link
                    href={item.href}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-xs font-bold transition-colors"
                  >
                    View Listing <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => remove(item.id)}
                    title="Remove from favorites"
                    aria-label={`Remove ${item.title} from favorites`}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 hover:border-red-300 hover:text-[#D32F2F] hover:bg-red-50 text-slate-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 bg-[#0F172A] text-white text-sm font-semibold rounded-xl shadow-2xl" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}