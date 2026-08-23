import React, { Suspense } from 'react';
import PromoteAdView from '@/components/promote/PromoteAdView';

export default function PromotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <p className="text-sm font-medium text-slate-400">Loading promotion options...</p>
        </div>
      }
    >
      <PromoteAdView />
    </Suspense>
  );
}