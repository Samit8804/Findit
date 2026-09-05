import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { mockListings } from '@/data/mockData';
import { createClient } from '@supabase/supabase-js';

function slugifyTitle(title: string): string {
  return title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
}

function findMockListing(slug: string) {
  return (
    mockListings.find((l) => slug.startsWith(l.id)) ||
    mockListings.find((l) => slugifyTitle(l.title) === slug) ||
    null
  );
}

async function fetchSupabaseAd(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const sb = createClient(url, key);
    const { data } = await sb
      .from('ads')
      .select('id, slug, title, description, price, currency, status, created_at, published_at, expires_at, deleted_at, user_id, city:location_id(name), category:category_id(name, slug), ad_images(image_url, is_primary, sort_order)')
      .eq('slug', slug)
      .maybeSingle();
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

  // Fallback mock
  const mock = findMockListing(decoded);
  if (!mock) return { title: 'Listing Not Found | FindIt', robots: { index: false, follow: false } };
  return generateAdMetadata({
    title: mock.title,
    slug: decoded,
    description: mock.description,
    price: mock.price,
    currency: mock.currency,
    category: mock.category,
    location: mock.location,
    imageUrl: mock.images[0],
  });
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

  // Try Supabase
  const sbAd: any = await fetchSupabaseAd(decoded);
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

  // Mock fallback
  const listing: any = findMockListing(decoded);
  if (!listing) notFound();

  const isExpiredMock = false; // mock listings are always active

  const breadcrumbs = [
    { name: listing.category, path: `/category/${listing.categorySlug}` },
    { name: listing.subcategory || listing.location, path: `/location/${listing.locationSlug}` },
    { name: listing.title },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <JsonLd data={[
        breadcrumbJsonLd(breadcrumbs.slice(0, -1).map((b: any) => ({ name: b.name, path: b.path }))),
        productJsonLd({
          title: listing.title,
          description: listing.description,
          price: listing.price,
          currency: listing.currency,
          imageUrl: listing.images[0],
          url: `${SITE_URL}/ad/${decoded}`,
          city: listing.location,
          category: listing.category,
        }),
      ]} />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[
            { label: 'Browse Ads', href: '/browse' },
            { label: listing.category, href: `/category/${listing.categorySlug}` },
            { label: listing.subcategory || listing.title },
          ]} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <Gallery images={listing.images} title={listing.title} />
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-bold mb-3">Description</h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
                <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><span className="text-slate-500">Category</span><Link href={`/category/${listing.categorySlug}`} className="font-semibold text-[#E53935] hover:underline">{listing.category}</Link></div>
                  <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between"><span className="text-slate-500">Location</span><Link href={`/location/${listing.locationSlug}`} className="font-semibold">{listing.location}</Link></div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <div className="flex flex-wrap gap-2 mb-3">
                  {listing.featured && <Badge variant="featured">Featured</Badge>}
                  {listing.promoted && <Badge variant="warning">Promoted</Badge>}
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-4">{listing.title}</h1>
                <p className="text-3xl font-black text-[#E53935] mb-4">₹{listing.price.toLocaleString('en-IN')}</p>
                <div className="space-y-1.5 text-sm text-slate-500 pb-5 mb-5 border-b border-slate-100">
                  <p>{listing.location} · Posted {listing.postedAt}</p>
                  <p>{listing.views} views · {listing.favorites} favourites</p>
                </div>
                <ContactButtons
                  adId={listing.id}
                  sellerUserId={listing.seller.name}
                  sellerName={listing.seller.name}
                  adTitle={listing.title}
                />
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <FavouriteButton variant="button" />
                  <ShareButton title={listing.title} />
                  <div className="flex justify-center"><ReportButton /></div>
                </div>
              </div>
              <SellerCard name={listing.seller.name} joinedAt={listing.seller.joinedAt} verified={listing.seller.verified} />
              <SafetyTipsCard />
            </div>
          </div>

          {/* Related Ads - internal linking */}
          <section className="mt-14" aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-xl font-bold mb-6">Related Ads</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {mockListings.filter((l) => l.categorySlug === listing.categorySlug && l.id !== listing.id).slice(0, 4).map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
