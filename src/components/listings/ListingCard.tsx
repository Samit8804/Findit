'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Heart, ShieldCheck } from 'lucide-react';
import { Listing } from '@/types';
import { Badge } from '../ui/Badge';
import { ImageCarousel } from './ImageCarousel';

interface ListingCardProps {
  listing: Listing;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const [isFavorite, setIsFavorite] = React.useState(false);

  const slug = listing.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
  const adHref = `/ad/${listing.id}-${slug}`;
  const imgAlt = `${listing.title} for sale in ${listing.location} - ${listing.category}`;

  return (
    <div className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <ImageCarousel images={listing.images} alt={imgAlt} />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {listing.featured && (
            <Badge variant="featured">Featured</Badge>
          )}
          {listing.promoted && (
            <Badge variant="warning">Promoted</Badge>
          )}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
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
        <div className="absolute bottom-3 left-3">
          <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
            {listing.condition === 'new' ? 'Brand New' : 'Used'}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-[#0F172A]">
            {listing.currency}{listing.price.toLocaleString()}
          </span>
          {listing.verified && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          )}
        </div>

        <Link href={adHref} className="block mb-2" aria-label={`View details for ${listing.title}`}>
          <h3 className="font-semibold text-[#0F172A] hover:text-[#E53935] transition-colors line-clamp-2 text-sm leading-snug">
            {listing.title}
          </h3>
        </Link>

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
};
