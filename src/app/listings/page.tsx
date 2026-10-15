import React, { Suspense } from 'react';
import { ListingGallery } from '@/components/listings/ListingGallery';

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC]" />}>
      <ListingGallery mode="listings" />
    </Suspense>
  );
}
