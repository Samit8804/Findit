import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SearchX, Home, Compass, LifeBuoy } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <main className="flex-grow flex items-center justify-center py-16 px-4">
        <div className="text-center max-w-lg">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-7">
            <SearchX className="w-12 h-12 text-[#E53935]" />
          </div>
          <p className="text-6xl font-black text-slate-400 mb-3">404</p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Listing not found</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-8 max-w-md mx-auto">
            The page or listing you&apos;re looking for doesn&apos;t exist, was removed by its owner,
            or expired. It may have been moved — try browsing the marketplace instead.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-lg shadow-red-200"
            >
              <Compass className="w-4 h-4" /> Browse Ads
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-sm font-bold transition-colors"
            >
              <Home className="w-4 h-4" /> Go Home
            </Link>
            <Link href="/help" className="inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold text-slate-500 hover:text-[#E53935] transition-colors">
              <LifeBuoy className="w-3.5 h-3.5" /> Help Center
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}