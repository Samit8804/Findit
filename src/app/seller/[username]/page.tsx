import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ListingCard } from '@/components/listings/ListingCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_URL, breadcrumbJsonLd } from '@/lib/seo';
import { ShieldCheck, MapPin, Calendar, Package, Award, Flag, Ban } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

interface Props { params: Promise<{ username: string }> }

const RESERVED = new Set(['admin','administrator','support','help','api','login','register','dashboard','settings','messages','system']);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchProfile(username);
  if (!profile) return { title: 'Seller Not Found | FindIt', robots: { index: false, follow: false } };
  const title = `${profile.display_name || profile.username} – Seller on FindIt`;
  const description = profile.bio
    ? profile.bio.slice(0, 155)
    : `Browse active listings from ${profile.display_name || profile.username} on FindIt.`;
  const url = `${SITE_URL}/seller/${profile.username}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: profile.activeCount > 0 ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title, description, url, type: 'profile',
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : undefined,
    },
  };
}

async function fetchProfile(username: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Fallback to mock for local demo - find by username slug
    const { mockListings } = await import('@/data/mockData');
    const listing = mockListings.find((l) => l.seller.name.toLowerCase().replace(/[^a-z0-9]+/g,'-') === username);
    if (!listing) return null;
    return {
      id: 'mock-'+username, username, display_name: listing.seller.name, avatar_url: null,
      bio: 'Trusted seller on FindIt.', location_text: listing.location, account_type: 'individual',
      email_verified: listing.seller.verified, phone_verified: false, business_verified: false,
      created_at: '2022-01-01', activeCount: 1,
    } as any;
  }
  const sb = createClient(url, key);
  const { data } = await sb.from('profiles').select('*').eq('username', username.toLowerCase()).single();
  if (!data) return null;
  if (data.account_status === 'banned' || data.account_status === 'suspended') return null;
  // eligible if has active listings or is business verified? We'll check counts after
  const { count } = await sb.from('ads').select('id', { count: 'exact', head: true }).eq('user_id', data.id).eq('status','approved').is('deleted_at', null).gt('expires_at', new Date().toISOString());
  return { ...data, activeCount: count || 0 };
}

export default async function SellerProfilePage({ params }: Props) {
  const { username } = await params;
  if (RESERVED.has(username.toLowerCase())) notFound();
  const profile = await fetchProfile(username);
  if (!profile) notFound();

  const isEligible = profile.activeCount > 0;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let listings: any[] = [];
  if (url && key) {
    const sb = createClient(url, key);
    const { data } = await sb.from('ads')
      .select('id, slug, title, description, price, condition, created_at, views_count, favorites_count, is_featured, currency, ad_images(image_url,is_primary), locations!inner(name)')
      .eq('user_id', profile.id).eq('status','approved').is('deleted_at', null).order('created_at', { ascending: false }).limit(12);
    listings = data || [];
  }

  // Mock fallback listings for demo if no real ads
  if (listings.length === 0) {
    const { mockListings } = await import('@/data/mockData');
    listings = mockListings.filter((l) => l.seller.name.toLowerCase().replace(/[^a-z0-9]+/g,'-') === username).slice(0, 8).map((l) => ({
      slug: l.id, title: l.title, price: l.price, currency: l.currency,
      description: l.description, images: l.images, location: l.location,
    }));
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <JsonLd data={breadcrumbJsonLd([{ name: profile.display_name || profile.username, path: `/seller/${profile.username}` }])} />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: 'Sellers', href: '/browse' }, { label: profile.display_name || profile.username }]} />

          {/* Header */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 mt-4 mb-8 flex flex-col md:flex-row gap-6">
            <div className="w-24 h-24 rounded-3xl bg-[#E53935] text-white font-black text-3xl flex items-center justify-center shrink-0 overflow-hidden">
              {profile.avatar_url ? <Image src={profile.avatar_url} alt={profile.display_name || profile.username} width={96} height={96} className="w-full h-full object-cover" /> : (profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 flex-wrap">
                {profile.display_name || profile.username}
                <span className="text-xs font-bold text-slate-400">@{profile.username}</span>
                {profile.email_verified && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><ShieldCheck className="w-3 h-3" /> Email Verified</span>}
                {profile.phone_verified && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><ShieldCheck className="w-3 h-3" /> Phone Verified</span>}
                {profile.business_verified && <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-full"><Award className="w-3 h-3" /> Business Verified</span>}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                {profile.location_text && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {profile.location_text}</span>}
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Member since {memberSince}</span>
                <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {profile.activeCount} Active Listings</span>
                <span className="capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">{profile.account_type}</span>
              </div>
              {profile.bio && <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-2xl">{profile.bio}</p>}
              <div className="flex gap-2 mt-4">
                <Link href={`/dashboard/messages?seller=${profile.username}`} className="px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-sm font-bold hover:bg-[#D32F2F]">Message Seller</Link>
                <Link href="/help" className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5"><Flag className="w-4 h-4" /> Report User</Link>
              </div>
            </div>
          </div>

          {/* Active Listings */}
          <h2 className="text-xl font-black mb-6">Active Listings ({listings.length})</h2>
          {listings.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <p className="text-sm text-slate-500">This seller has no active listings right now.</p>
              <Link href="/browse" className="inline-block mt-4 text-sm font-semibold text-[#E53935] hover:underline">Browse all ads</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {listings.map((l: any) => (
                <Link key={l.id || l.slug} href={`/ad/${l.slug}`} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {l.images ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.ad_images?.find((i:any)=>i.is_primary)?.image_url || l.images?.[0] || ''} alt={`${l.title} for sale in ${l.locations?.name || l.location || ''}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">No image</div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-sm line-clamp-2 leading-snug">{l.title}</p>
                    <p className="text-sm font-black text-[#E53935] mt-1">₹{Number(l.price).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-400 mt-1">{l.locations?.name || l.location || ''}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
