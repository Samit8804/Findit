import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import PromoteView from '@/components/promote/PromoteView';

export default function PromotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <PromoteView />
    </Suspense>
  );
}