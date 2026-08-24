'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Gallery } from '@/components/listings/Gallery';
import { ShareButton } from '@/components/share/ShareButton';
import { SellerCard, SafetyTipsCard } from '@/components/listings/SellerCard';
import { ContactButtons } from '@/components/listings/ContactButtons';
import { ListingCard } from '@/components/listings/ListingCard';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  getPublicAdBySlug,
  listPublicAds,
  toggleFavorite,
  getFavoriteState,
  PublicAd,
} from '@/services/ads';
import { getMyProfile, canUseMessaging } from '@/services/profile';
import { useToast } from '@/components/ui/Feedback';
import {
  MapPin,
  Eye,
  Clock,
  ShieldCheck,
  Hash,
  Tag,
  Layers,
  ArrowRight,
  Heart,
  SearchX,
  Hourglass,
  PencilLine,
  Lock,
} from 'lucide-react';

export default function AdDetailView() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug);
  const toast = useToast();

  const [ad, setAd] = useState<PublicAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fav, setFav] = useState(false);
  const [similar, setSimilar] = useState<PublicAd[]>([]);
  const [messagingLocked, setMessagingLocked] = useState(!isSupabaseConfigured ? false : null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getMyProfile().then((p) => setMessagingLocked(p ? !canUseMessaging(p.plan) : true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getPublicAdBySlug(slug)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setNotFound(true);
        } else {
          setAd(result);
          void getFavoriteState(result.id).then((f) => !cancelled && setFav(f));
          if (result.categorySlug) {
            listPublicAds({ categorySlug: result.categorySlug })
              .then((res) => !cancelled && setSimilar(res.ads.filter((a) => a.id !== result.id).slice(0, 4)))
              .catch(() => {});
          }
        }
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [slug]);

  const handleToggleFav = async () => {
    if (!ad) return;
    try {
      const next = await toggleFavorite(ad.id);
      setFav(next);
      toast(next ? 'Added to favorites' : 'Removed from favorites');
    } catch (e: any) {
      if (e.message === 'NOT_AUTHENTICATED') {
        toast('Please log in to save favorites');
      } else {
        toast("You don't have permission to perform this action.");
      }
    }
  };

  /* ---------------- loading ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
        <Header />
        <main className="flex-grow py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse" aria-busy="true">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="aspect-[16/10] rounded-xl bg-slate-200 mb-3" />
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-xl bg-slate-200" />)}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-8 space-y-3">
                <div className="h-5 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-full bg-slate-200 rounded" />
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-8 space-y-4">
                <div className="h-7 w-2/3 bg-slate-200 rounded" />
                <div className="h-9 w-32 bg-slate-200 rounded" />
                <div className="h-12 w-full bg-slate-200 rounded-xl" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ---------------- not found / not public ---------------- */
  if (!ad) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
        <Header />
        <main className="flex-grow flex items-center justify-center py-16 px-4 text-center">
          <div className="max-w-md">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <SearchX className="w-10 h-10 text-[#E53935]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-3">Listing not found</h1>
            <p className="text-sm text-slate-500 leading-relaxed mb-8">
              This advertisement is no longer available â€” it may have been removed, expired or is awaiting review.
            </p>
            <Link href="/browse" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-lg shadow-red-200">
              Browse Ads
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const primaryImage = ad.images.find((i) => i.isPrimary)?.url || ad.images[0]?.url || '';
  const postedDate = new Date(ad.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const related = similar.filter((a) => a.slug !== ad.slug);

  const toCardListing = (l: PublicAd) => ({
    id: l.id, title: l.title, description: l.description, price: l.price, currency: 'â‚¹',
    images: l.images.map((i) => i.url), category: l.categoryName, categorySlug: l.categorySlug,
    location: l.locationLabel, locationSlug: '', postedAt: new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    condition: (l.condition as any) || 'used_good', featured: l.isFeatured, promoted: false,
    verified: l.seller.verified, views: l.viewsCount, favorites: l.favoritesCount,
    contactEmail: '', seller: { name: l.seller.name, verified: l.seller.verified, joinedAt: '', email: '' },
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Status banners */}
          {ad.status === 'pending' && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-2" role="status">
              <Hourglass className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">This advertisement is awaiting review.</p>
            </div>
          )}
          {ad.status === 'rejected' && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100" role="status">
              <p className="text-sm font-semibold text-[#D32F2F] flex items-center gap-2">
                <PencilLine className="w-4 h-4" /> Changes are required before this advertisement can be published.
              </p>
            </div>
          )}

          <Breadcrumbs
            items={[
              { label: 'Browse Ads', href: '/browse' },
              ...(ad.categoryName ? [{ label: ad.categoryName, href: `/category/${ad.categorySlug}` }] : []),
              { label: ad.title },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative">
                <Gallery images={ad.images.length ? ad.images.map((i) => i.url) : ['']} title={ad.title} />
                {ad.status === 'sold' && (
                  <span className="absolute top-14 left-14 rotate-[-8deg] px-6 py-2 border-4 border-[#E53935] text-[#E53935] font-black text-2xl uppercase tracking-widest rounded-lg bg-white/80 backdrop-blur-xs">
                    Sold
                  </span>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <h2 className="text-lg font-bold mb-3">Description</h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{ad.description}</p>

                <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-slate-500 font-medium">Category</span>
                    <Link href={`/category/${ad.categorySlug}`} className="font-semibold text-[#E53935] hover:underline">{ad.categoryName || 'â€”'}</Link>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Condition</span>
                    <span className="font-semibold capitalize">{(ad.condition || '').replace(/_/g, ' - ')}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Posted</span>
                    <span className="font-semibold">{postedDate}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Ad ID</span>
                    <span className="font-semibold">{ad.id.slice(0, 8)}</span>
                  </div>
                </div>

                {/* Attributes */}
                {Object.keys(ad.attributes).length > 0 && (
                  <>
                    <h3 className="text-base font-bold mt-8 mb-3">Details</h3>
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(ad.attributes).map(([k, v]) => (
                        <div key={k} className="bg-slate-50 rounded-xl px-4 py-3">
                          <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{k.replace(/([A-Z])/g, ' $1')}</dt>
                          <dd className="text-sm font-semibold mt-0.5">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {ad.isFeatured && <Badge variant="featured">Featured</Badge>}
                  {ad.status === 'sold' && <Badge variant="secondary">Sold</Badge>}
                  {ad.seller.verified && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Seller
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-4">{ad.title}</h1>

                <p className="text-3xl font-black text-[#E53935] mb-4">â‚¹{ad.price.toLocaleString('en-IN')}</p>

                <div className="space-y-1.5 text-sm text-slate-500 pb-5 mb-5 border-b border-slate-100">
                  <p className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#E53935]" /> {ad.locationLabel || 'Location unavailable'}</p>
                  <p className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> Listed {postedDate}</p>
                  <p className="flex items-center gap-1.5"><Eye className="w-4 h-4 text-slate-400" /> {ad.viewsCount} views Â· {ad.favoritesCount} favourites</p>
                </div>

                {ad.seller.allowMessages ? (
                  <ContactButtons
                    phone={ad.seller.showPhone ? ad.seller.phone : undefined}
                    sellerName={ad.seller.name}
                    adTitle={ad.title}
                    messageLocked={messagingLocked === true}
                  />
                ) : (
                  <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-xl">The seller prefers email contact only.</p>
                )}

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <button
                    onClick={handleToggleFav}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                      fav ? 'bg-red-50 border-[#E53935] text-[#E53935]' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} /> {fav ? 'Saved' : 'Save'}
                  </button>
                  <ShareButton title={ad.title} url={typeof window !== 'undefined' ? window.location.href : undefined} />
                  <button
                    onClick={() => window.location.href = '/contact'}
                    className="flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500 hover:border-red-200 hover:text-[#E53935] transition-colors"
                  >
                    Report
                  </button>
                </div>
              </div>

              <SellerCard name={ad.seller.name} joinedAt="" verified={ad.seller.verified} />

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-base font-bold mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#E53935]" /> Location Details
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">{ad.locationLabel || 'â€”'}</p>
              </div>

              <SafetyTipsCard />
            </div>
          </div>

          {/* Similar listings */}
          {related.length > 0 && (
            <section className="mt-14 pb-8">
              <div className="flex items-end justify-between mb-6">
                <h2 className="text-xl font-bold">Similar Listings</h2>
                <Link href={`/category/${ad.categorySlug}`} className="text-sm font-semibold text-[#E53935] hover:underline flex items-center gap-1">
                  View More <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {related.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={{ ...(toCardListing(l)) } as any}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
