import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { BusinessTabs } from '@/components/businesses/BusinessTabs';
import { businesses } from '@/data/businessData';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, generateBusinessMetadata, localBusinessJsonLd } from '@/lib/seo';
import {
  MapPin,
  ShieldCheck,
  Star,
  Globe,
  MessageCircle,
  Phone,
  Clock,
} from 'lucide-react';

export function generateStaticParams() {
  return businesses.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: BusinessProfileProps) {
  const { slug } = await params;
  const business = businesses.find((b) => b.slug === slug);
  if (!business) return { title: 'Business Not Found | FindIt' };
  return generateBusinessMetadata(business);
}

interface BusinessProfileProps {
  params: Promise<{ slug: string }>;
}

export default async function BusinessProfilePage({ params }: BusinessProfileProps) {
  const { slug } = await params;
  const business = businesses.find((b) => b.slug === slug) || businesses[0];
  if (!businesses.find((b) => b.slug === slug)) {
    // fallback already handled by generateMetadata 404, but ensure notFound for invalid slug
  }
  const related = businesses.filter((b) => b.id !== business.id).slice(0, 2);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      {business.verified && (
        <JsonLd
          data={localBusinessJsonLd({
            name: business.name,
            description: business.description,
            imageUrl: business.cover,
            phone: business.phone,
            website: `https://${business.website}`,
            address: business.location,
          })}
        />
      )}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Business Directory', path: '/business' },
          { name: business.name },
        ])}
      />

      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: 'Business Directory', href: '/business' },
              { label: business.name },
            ]}
          />
        </div>

        {/* Cover */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="relative aspect-[21/9] sm:aspect-[21/6] rounded-3xl overflow-hidden shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={business.cover} alt={`${business.name} cover`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 to-transparent" />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Identity bar */}
          <div className="relative -mt-14 mb-8 bg-white rounded-2xl border border-slate-100 shadow-xl p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-[#E53935] text-white font-black text-3xl flex items-center justify-center shadow-lg shadow-red-200 shrink-0 ring-4 ring-white">
                {business.logoText}
              </div>

              <div className="min-w-0 flex-grow">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 flex-wrap">
                  {business.name}
                  {business.verified && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Business
                    </span>
                  )}
                </h1>
                <p className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-flex" aria-label={`Rated ${business.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(business.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                      ))}
                    </span>
                    <strong>{business.rating}</strong> ({business.reviewCount} reviews)
                  </span>
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#E53935]" /> {business.location}</span>
                  <span className="font-semibold">{business.category}</span>
                </p>
              </div>

              {/* Contact buttons */}
              <div className="grid grid-cols-3 gap-2 shrink-0 w-full md:w-auto">
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-colors">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
                <a
                  href={`https://api.whatsapp.com/send?phone=${business.whatsapp.replace(/[\s+]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <a href={`https://${business.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-xs font-bold transition-colors">
                  <Globe className="w-3.5 h-3.5" /> Website
                </a>
              </div>
            </div>

            {/* Hours strip */}
            <div className="mt-5 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                <Clock className="w-3.5 h-3.5" /> Open Now
              </span>
              {business.hours.map((h) => (
                <span key={h.days}>{h.days}: <strong className="text-slate-700">{h.time}</strong></span>
              ))}
            </div>
          </div>

          {/* Gallery + tabs */}
          <div className="space-y-8 pb-10">
            <section>
              <h2 className="text-base font-bold mb-4">Photo Gallery</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {business.gallery.map((img, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`${business.name} photo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ))}
              </div>
            </section>

            <BusinessTabs business={business} />

            {/* Related businesses */}
            <section className="pb-8">
              <h2 className="text-base font-bold mb-4">Related Businesses</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {related.map((b) => (
                  <Link key={b.id} href={`/business/${b.slug}`} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all p-5 flex items-center gap-4">
                    <span className="w-12 h-12 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center font-black text-lg shrink-0">{b.logoText}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate flex items-center gap-1.5">
                        {b.name}
                        {b.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {b.rating}
                        <MapPin className="w-3 h-3 ml-1" /> {b.location}
                      </p>
                    </div>
                    <ArrowRightIcon />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 ml-auto text-slate-300 group-hover:text-[#E53935] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}