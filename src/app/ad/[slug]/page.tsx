import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_URL, breadcrumbJsonLd, productJsonLd, generateAdMetadata } from '@/lib/seo';
import { Gallery } from '@/components/listings/Gallery';
import { ShareButton } from '@/components/share/ShareButton';
import { FavouriteButton, ReportButton } from '@/components/listings/ListingActions';
import { SellerCard, SafetyTipsCard } from '@/components/listings/SellerCard';
import { ContactButtons } from '@/components/listings/ContactButtons';
import { ListingCard } from '@/components/listings/ListingCard';
import { createClient } from '@supabase/supabase-js';

async function fetchSupabaseAd(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const sb = createClient(url, key);
    let { data } = await sb
      .from('ads')
      .select('id, slug, title, description, price, currency, status, created_at, published_at, expires_at, deleted_at, user_id, city:location_id(name), category:category_id(name, slug), ad_images(image_url, is_primary, sort_order)')
      .eq('slug', slug)
      .maybeSingle();
    // Backward compat: old URLs like /ad/{uuid}-{slug} or /ad/{uuid}
    if (!data && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(slug)) {
      const uuid = slug.slice(0, 36);
      const { data: byId } = await sb
        .from('ads')
        .select('id, slug, title, description, price, currency, status, created_at, published_at, expires_at, deleted_at, user_id, city:location_id(name), category:category_id(name, slug), ad_images(image_url, is_primary, sort_order)')
        .eq('id', uuid)
        .maybeSingle();
      if (byId) return { ...byId, redirectTo: byId.slug } as any;
    }
    if (!data) return null;
    // Fetch seller profile separately (ads.user_id -> profiles.id via auth)
    const profId = (data as any).user_id;
    let enriched: any = data;
    if (profId) {
      const { data: prof } = await sb.from('profiles').select('name').eq('id', profId).maybeSingle();
      if (prof) enriched = { ...data, profiles: prof };
    }
    return enriched as any;
  } catch {
    return null;
  }
}

interface AdPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AdPageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  // Try Supabase first
  const sbAd: any = await fetchSupabaseAd(decoded);
  if (sbAd) {
    const isPublic = sbAd.status === 'approved' && !sbAd.deleted_at && (!sbAd.expires_at || new Date(sbAd.expires_at) > new Date());
    if (!isPublic) {
      return {
        title: 'Listing Not Available | FindIt',
        robots: { index: false, follow: false },
      };
    }
    const image = sbAd.ad_images?.find((i: any) => i.is_primary)?.image_url || sbAd.ad_images?.[0]?.image_url;
    return generateAdMetadata({
      title: sbAd.title,
      slug: sbAd.slug,
      description: sbAd.description,
      price: sbAd.price,
      currency: sbAd.currency || '₹',
      category: sbAd.category?.name,
      location: sbAd.city?.name,
      imageUrl: image,
      status: sbAd.status,
    });
  }

  return { title: 'Listing Not Found | FindIt', robots: { index: false, follow: false } };
}

function AdExpiredState({ title }: { title: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
      <h2 className="text-xl font-black text-amber-800 mb-2">This advertisement has expired.</h2>
      <p className="text-sm text-amber-700 mb-4">The listing &ldquo;{title}&rdquo; is no longer available. Browse similar ads below.</p>
      <Link href="/browse" className="inline-flex px-6 py-3 rounded-xl bg-[#E53935] text-white text-sm font-bold">Browse Similar Ads</Link>
    </div>
  );
}

export default async function AdDetailPage({ params }: AdPageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  // Try Supabase (with backward compat for old /ad/{uuid}-{slug})
  const fetched: any = await fetchSupabaseAd(decoded);
  if (fetched?.redirectTo) redirect(`/ad/${fetched.redirectTo}`);
  const sbAd: any = fetched;
  if (sbAd) {
    const isDeleted = !!sbAd.deleted_at;
    const isExpired = sbAd.expires_at && new Date(sbAd.expires_at) < new Date();
    if (isDeleted) notFound();
    if (sbAd.status !== 'approved') {
      // Show pending/rejected with noindex but still render preview
      const image = sbAd.ad_images?.find((i: any) => i.is_primary)?.image_url;
      return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
          <Header />
          <main className="flex-grow py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center mb-6">
                <p className="text-sm font-bold text-amber-800">This advertisement is awaiting review and is not yet public.</p>
              </div>
              <h1 className="text-2xl font-black">{sbAd.title}</h1>
              <p className="text-sm text-slate-500 mt-2">{sbAd.description.slice(0, 200)}</p>
            </div>
          </main>
          <Footer />
        </div>
      );
    }
    if (isExpired) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
          <Header />
          <main className="flex-grow py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Breadcrumbs items={[{ label: 'Browse Ads', href: '/browse' }, { label: sbAd.title }]} />
              <div className="mt-6">
                <AdExpiredState title={sbAd.title} />
              </div>
              <JsonLd data={productJsonLd({
                title: sbAd.title,
                description: sbAd.description,
                price: sbAd.price, currency: sbAd.currency || '₹',
                imageUrl: sbAd.ad_images?.[0]?.image_url,
                url: `${SITE_URL}/ad/${sbAd.slug}`,
                city: sbAd.city?.name, sold: true,
              })} />
            </div>
          </main>
          <Footer />
        </div>
      );
    }

    // Approved & active - full page
    const images = (sbAd.ad_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((i: any) => i.image_url);
    const category = sbAd.category;
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
        <Header />
        <JsonLd data={[
          breadcrumbJsonLd([
            { name: category?.name || 'Category', path: category ? `/category/${category.slug}` : '/browse' },
            { name: sbAd.title },
          ]),
          productJsonLd({
            title: sbAd.title,
            description: sbAd.description,
            price: sbAd.price, currency: sbAd.currency || '₹',
            imageUrl: images[0], url: `${SITE_URL}/ad/${sbAd.slug}`,
            city: sbAd.city?.name,
          }),
        ]} />
        <main className="flex-grow py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs items={[
              { label: 'Browse Ads', href: '/browse' },
              ...(category ? [{ label: category.name, path: `/category/${category.slug}` } as any] : []),
              { label: sbAd.title },
            ]} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <Gallery images={images} title={sbAd.title} />
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                  <h2 className="text-lg font-bold mb-3">Description</h2>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{sbAd.description}</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-4">{sbAd.title}</h1>
                  <p className="text-3xl font-black text-[#E53935] mb-4">₹{Number(sbAd.price).toLocaleString('en-IN')}</p>
                  <p className="text-sm text-slate-500 mb-4">{sbAd.city?.name || ''}</p>
                  <div className="pt-4 border-t border-slate-100">
                    <SellerCard name={sbAd.profiles?.name || 'Seller'} joinedAt={new Date(sbAd.created_at).toLocaleDateString()} verified={false} />
                  </div>
                </div>
                <SafetyTipsCard />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Real-data only: no mock fallback
  notFound();
}
