import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SearchBar } from '@/components/search/SearchBar';
import { CategoryCard } from '@/components/categories/CategoryCard';
import { ListingCard } from '@/components/listings/ListingCard';
import { BusinessCard } from '@/components/businesses/BusinessCard';
import { LocationCard } from '@/components/locations/LocationCard';
import { Button } from '@/components/ui/Button';
import { categories, locations, mockListings, promotedBusinesses } from '@/data/mockData';

export default function Home() {
  const featuredListings = mockListings.filter((l) => l.featured).slice(0, 8);
  const latestListings = mockListings.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#F8FAFC] pt-12 pb-20 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 text-[#E53935] text-xs font-bold tracking-wide uppercase">
                  <Sparkles className="w-4 h-4" /> Trusted by 2M+ Local Users
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#0F172A] leading-[1.1]">
                  Find the Best Things <span className="text-[#E53935]">Around You</span>
                </h1>
                <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Buy, sell or find anything you need in your local area. From luxury properties and cars to mobiles, jobs, and professional services.
                </p>

                {/* Search Bar */}
                <div className="pt-2">
                  <SearchBar />
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
                  <Link href="/browse">
                    <Button variant="primary" size="lg" className="shadow-lg">
                      Browse Ads
                    </Button>
                  </Link>
                  <Link href="/post-ad">
                    <Button variant="outline" size="lg" className="border-slate-300">
                      Post an Ad Free
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 relative">
                <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                  <Image
                    src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800"
                    alt="Marketplace Hero"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-6">
                    <div className="text-white">
                      <span className="px-2.5 py-1 rounded-lg bg-[#E53935] text-xs font-bold uppercase tracking-wider mb-2 inline-block">
                        Featured Deal
                      </span>
                      <h3 className="text-lg font-bold">Verified Luxury Apartments in Noida</h3>
                      <p className="text-xs text-slate-200">Starting from ₹1.45 Cr onwards</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs font-bold text-[#E53935] tracking-widest uppercase mb-1 block">
                  EXPLORE CATEGORIES
                </span>
                <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">
                  Browse Popular Categories
                </h2>
              </div>
              <Link href="/browse" className="text-sm font-semibold text-[#E53935] hover:underline flex items-center gap-1">
                View All Categories <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </div>
        </section>

        {/* Featured Listings Section */}
        <section className="py-20 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs font-bold text-[#E53935] tracking-widest uppercase mb-1 block">
                  HANDPICKED ADS
                </span>
                <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">
                  Featured Listings
                </h2>
              </div>
              <Link href="/browse" className="text-sm font-semibold text-[#E53935] hover:underline flex items-center gap-1">
                View All Listings <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>

        {/* Browse By Location Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs font-bold text-[#E53935] tracking-widest uppercase mb-1 block">
                  LOCAL DISCOVERY
                </span>
                <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">
                  Browse By Location
                </h2>
              </div>
              <p className="text-sm text-slate-500">Explore verified ads in your neighborhood</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {locations.map((location) => (
                <LocationCard key={location.id} location={location} />
              ))}
            </div>
          </div>
        </section>

        {/* Latest Listings Section */}
        <section className="py-20 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs font-bold text-[#E53935] tracking-widest uppercase mb-1 block">
                  FRESH FINDS
                </span>
                <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">
                  Latest Listings
                </h2>
              </div>
              <Link href="/browse" className="text-sm font-semibold text-[#E53935] hover:underline flex items-center gap-1">
                Explore Marketplace <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {latestListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>

        {/* Promoted Businesses Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs font-bold text-[#E53935] tracking-widest uppercase mb-1 block">
                  TRUSTED PARTNERS
                </span>
                <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">
                  Promoted Businesses
                </h2>
              </div>
              <p className="text-sm text-slate-500">Discover professional brands and stores</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {promotedBusinesses.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>
          </div>
        </section>

        {/* Advertising Banner Section */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0F172A] to-slate-900 p-8 sm:p-12 lg:p-16 text-white shadow-2xl">
              <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 hidden lg:block">
                <Image
                  src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=800"
                  alt="Advertise"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative z-10 max-w-xl space-y-4">
                <span className="px-3 py-1 rounded-full bg-red-500/20 text-[#E53935] text-xs font-bold tracking-wider uppercase inline-block">
                  GROW YOUR REVENUE
                </span>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                  Grow Your Business With Us
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Advertise your business on FindIt and reach thousands of active local customers every single day. Boost visibility, generate leads, and scale faster.
                </p>
                <div className="pt-2">
                  <Link href="/browse">
                    <Button variant="primary" size="lg" className="shadow-lg">
                      Advertise Now
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
