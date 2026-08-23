import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Location } from '@/types';

interface LocationCardProps {
  location: Location;
}

export const LocationCard: React.FC<LocationCardProps> = ({ location }) => {
  return (
    <Link
      href={`/browse?city=${location.slug}`}
      className="group relative rounded-2xl overflow-hidden aspect-[4/3] block shadow-sm hover:shadow-xl transition-all duration-300"
    >
      <Image
        src={location.image}
        alt={location.name}
        fill
        className="object-cover group-hover:scale-110 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 via-[#0F172A]/20 to-transparent group-hover:from-[#0F172A]/90 transition-colors" />
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <h3 className="text-lg font-bold mb-0.5 group-hover:text-red-400 transition-colors">
          {location.name}
        </h3>
        <p className="text-xs text-slate-300 font-medium">
          {location.listingCount.toLocaleString()} ads available
        </p>
      </div>
    </Link>
  );
};
