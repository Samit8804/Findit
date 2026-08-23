import React, { Suspense } from 'react';
import CheckoutView from '@/components/payment/CheckoutView';

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <p className="text-sm font-medium text-slate-400">Loading checkout...</p>
        </div>
      }
    >
      <CheckoutView />
    </Suspense>
  );
}