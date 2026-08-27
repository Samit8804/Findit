import React from 'react';
import Image from 'next/image';
import { MapPin, Star, ShieldCheck } from 'lucide-react';
import { Business } from '@/types';
import { Badge } from '../ui/Badge';

interface BusinessCardProps {
  business: Business;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({ business }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        <Image
          src={business.image}
          alt={`${business.name} - ${business.category} business in ${business.location}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3">
          <Badge variant="warning">PROMOTED</Badge>
        </div>
        {business.verified && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#E53935] transition-colors">
            {business.name}
          </h3>
          <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg text-amber-700 text-xs font-semibold">
            <Star className="w-3.5 h-3.5 fill-current" />
            {business.rating} ({business.reviewCount})
          </div>
        </div>

        <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
          {business.description}
        </p>

        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            {business.location}
          </span>
          <span className="text-[#E53935] font-semibold group-hover:underline">Visit Store →</span>
        </div>
      </div>
    </div>
  );
};
