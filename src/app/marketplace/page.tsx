import React, { Suspense } from 'react';
import { ListingGallery } from '@/components/listings/ListingGallery';

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC]" />}>
      <ListingGallery mode="marketplace" />
    </Suspense>
  );
}
