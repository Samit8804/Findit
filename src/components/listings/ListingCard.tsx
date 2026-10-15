'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Heart, ShieldCheck } from 'lucide-react';
import { Listing } from '@/types';
import { Badge } from '../ui/Badge';
import { ImageCarousel } from './ImageCarousel';
import { formatINR } from '@/lib/format';
import { getAdUrl } from '@/lib/adUrl';

interface ListingCardProps {
  listing: Listing;
  showFavorite?: boolean;
  showCondition?: boolean;
  wholeCardLink?: boolean;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  showFavorite = true,
  showCondition = true,
  wholeCardLink = false,
}) => {
  const [isFavorite, setIsFavorite] = React.useState(false);

  const adHref = getAdUrl(listing.slug);
  const imgAlt = `${listing.title} for sale in ${listing.location} - ${listing.category}`;
  // PublicAd.images is {url,isPrimary,sortOrder}[]; Listing.images is string[] — support both without mock data
  const imageUrls: string[] = ((listing as any).images ?? [])
    .map((img: any) => (typeof img === 'string' ? img : img?.url))
    .filter((u: any): u is string => typeof u === 'string' && u.trim().length > 0);

  const card = (
    <div className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <ImageCarousel images={imageUrls} alt={imgAlt} />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {listing.promotionLabel && (
            <Badge variant={listing.promotionLabel === 'TOP' ? 'primary' : 'featured'}>
              {listing.promotionLabel}
            </Badge>
          )}
          {!listing.promotionLabel && listing.featured && (
            <Badge variant="featured">Featured</Badge>
          )}
          {!listing.promotionLabel && listing.promoted && (
            <Badge variant="warning">Promoted</Badge>
          )}
        </div>
        {showFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFavorite(!isFavorite);
            }}
            className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors ${
              isFavorite
                ? 'bg-red-500 text-white'
                : 'bg-white/80 text-slate-700 hover:bg-white'
            }`}
            aria-label="Save to favourites"
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
        {showCondition && (
          <div className="absolute bottom-3 left-3">
            <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
              {listing.condition === 'new' ? 'Brand New' : 'Used'}
            </span>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-[#0F172A]">
            {formatINR(listing.price)}
          </span>
          {listing.verified && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          )}
        </div>

        {wholeCardLink ? (
          <h3 className="mb-2 line-clamp-2 break-words text-sm font-semibold leading-snug text-[#0F172A] [overflow-wrap:anywhere]">
            {listing.title.length > 80 ? `${listing.title.slice(0, 77)}...` : listing.title}
          </h3>
        ) : (
          <Link href={adHref} className="mb-2 block" aria-label={`View details for ${listing.title}`}>
            <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-[#0F172A] transition-colors hover:text-[#E53935] [overflow-wrap:anywhere]">
              {listing.title.length > 80 ? `${listing.title.slice(0, 77)}...` : listing.title}
            </h3>
          </Link>
        )}

        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1 truncate max-w-[140px]">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {listing.location}
          </span>
          <span className="font-medium text-slate-400">{listing.postedAt}</span>
        </div>
      </div>
    </div>
  );

  return wholeCardLink ? (
    <Link
      href={adHref}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E53935]"
      aria-label={`View details for ${listing.title}`}
    >
      {card}
    </Link>
  ) : card;
};
