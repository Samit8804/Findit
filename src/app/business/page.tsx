import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SearchBar } from '@/components/search/SearchBar';
import { businesses, businessCategories } from '@/data/businessData';
import { MapPin, Star, ShieldCheck, ArrowRight, Building2, Sparkles, Search } from 'lucide-react';

export default function BusinessDirectoryPage() {
  const promoted = businesses.filter((b) => b.promoted);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow">
        {/* Hero */}
        <section className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-slate-100 pt-14 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 text-[#E53935] text-xs font-bold tracking-wide uppercase mb-5">
              <Building2 className="w-4 h-4" /> FindIt Business Directory
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Discover Trusted <span className="text-[#E53935]">Local Businesses</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mt-4 leading-relaxed">
              Hand-verified shops, studios and service providers near you — read reviews, compare and connect in one tap.
            </p>
            <div className="max-w-2xl mx-auto mt-8">
              <SearchBar />
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
          {/* Category cards */}
          <section>
            <h2 className="text-xl font-black mb-6">Browse by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
              {businessCategories.map((cat) => (
                <Link
                  key={cat}
                  href={`/business?category=${encodeURIComponent(cat)}`}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col items-center text-center gap-2 group"
                >
                  <span className="w-10 h-10 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                    <Building2 className="w-5 h-5" />
                  </span>
                  <span className="text-xs font-bold leading-tight">{cat}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Location filters */}
          <section>
            <h2 className="text-xl font-black mb-6">Top Locations</h2>
            <div className="flex flex-wrap gap-3">
              {['Noida', 'Greater Noida', 'Delhi', 'Gurgaon', 'Ghaziabad'].map((city) => (
                <Link
                  key={city}
                  href={`/business?location=${encodeURIComponent(city)}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 hover:border-[#E53935] hover:text-[#E53935] text-sm font-semibold transition-colors"
                >
                  <MapPin className="w-4 h-4 text-[#E53935]" /> Businesses in {city}
                </Link>
              ))}
            </div>
          </section>

          {/* Featured */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <span className="text-xs font-bold text-[#E53935] tracking-widest uppercase block mb-1">EDITOR&apos;S PICKS</span>
                <h2 className="text-xl font-black">Featured Businesses</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {businesses.filter((b) => b.featured).map((b) => (
                <BusinessDirectoryCard key={b.id} business={b} featured />
              ))}
            </div>
          </section>

          {/* Promoted */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <span className="text-xs font-bold text-[#E53935] tracking-widest uppercase block mb-1">
                  <Sparkles className="w-3 h-3 inline mr-1" /> PARTNER SPOTLIGHT
                </span>
                <h2 className="text-xl font-black">Promoted Businesses</h2>
              </div>
              <Link href="/pricing" className="text-xs font-bold text-[#E53935] hover:underline flex items-center gap-1">
                List your business <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {promoted.map((b) => (
                <BusinessPromotedCard key={b.id} business={b} />
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ---------- Cards ---------- */

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
      ))}
    </span>
  );
}

function BusinessDirectoryCard({ business: b }: { business: import('@/data/businessData').Business; featured?: boolean }) {
  return (
    <Link
      href={`/business/${b.slug}`}
      className="group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 block"
    >
      <div className="relative aspect-[16/9]">
        <Image src={b.cover} alt={b.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/90 via-[#0F172A]/30 to-transparent" />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-bold uppercase tracking-wide">
            Featured
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center text-[#E53935] font-black text-xl shrink-0">
            {b.logoText}
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-black text-lg flex items-center gap-2">
              {b.name}
              {b.verified && <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
            </h3>
            <p className="text-xs text-slate-300 flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {b.location}</span>
              <span className="flex items-center gap-1"><Stars rating={b.rating} /> {b.rating}</span>
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function BusinessPromotedCard({ business: b }: { business: import('@/data/businessData').Business }) {
  return (
    <Link
      href={`/business/${b.slug}`}
      className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
        <Image src={b.cover} alt={b.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-50/95 backdrop-blur text-amber-700 text-[10px] font-bold uppercase tracking-wider">
          Promoted
        </span>
      </div>
      <div className="p-5 flex-grow flex flex-col">
        <h3 className="font-black flex items-center gap-2 text-[15px]">
          <span className="w-8 h-8 rounded-lg bg-red-50 text-[#E53935] flex items-center justify-center text-sm shrink-0">{b.logoText}</span>
          <span className="truncate">{b.name}</span>
          {b.verified && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
        </h3>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
          <span className="flex items-center gap-1"><Stars rating={b.rating} /> {b.rating} ({b.reviewCount})</span>
        </p>
        <p className="text-xs text-slate-500 line-clamp-2 mt-3 leading-relaxed">{b.description}</p>
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100 mt-4">
          <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" /> {b.location}
          </span>
          <span className="text-xs font-bold text-[#E53935] group-hover:underline">Visit →</span>
        </div>
      </div>
    </Link>
  );
}

export function BusinessSearchHint() {
  return <Search className="w-4 h-4 text-slate-400" />;
}