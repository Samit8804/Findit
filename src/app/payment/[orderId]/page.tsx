import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import CheckoutView from '@/components/payment/CheckoutView';

interface PaymentByIdPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function PaymentByIdPage({ params }: PaymentByIdPageProps) {
  const { orderId } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <CheckoutView initialOrderId={orderId} />
    </Suspense>
  );
}