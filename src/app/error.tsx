'use client';

import React from 'react';
import Link from 'next/link';
import { AlertOctagon, RotateCcw, Home, LifeBuoy } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#E53935] flex items-center justify-center text-white font-black">F</div>
            <span className="text-lg font-black tracking-tight">Find<span className="text-[#E53935]">It</span></span>
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center py-16 px-4">
        <div className="text-center max-w-lg">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-7">
            <AlertOctagon className="w-12 h-12 text-[#E53935]" />
          </div>
          <p className="text-6xl font-black text-slate-200 mb-3">500</p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Something went wrong</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-8 max-w-md mx-auto">
            An unexpected error interrupted your request. Our engineers have been notified
            {error.digest ? ` (ref: ${error.digest})` : ''}. Try again — the issue is usually temporary.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-lg shadow-red-200"
            >
              <RotateCcw className="w-4 h-4" /> Try Again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-sm font-bold transition-colors"
            >
              <Home className="w-4 h-4" /> Go Home
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold text-slate-500 hover:text-[#E53935] transition-colors">
              <LifeBuoy className="w-3.5 h-3.5" /> Contact Support
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}