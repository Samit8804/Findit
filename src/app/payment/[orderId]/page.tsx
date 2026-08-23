import React, { Suspense } from 'react';
import CheckoutView from '@/components/payment/CheckoutView';

interface PaymentByIdPageProps {
  params: Promise<{ orderId: string }>;
}

export function generateStaticParams() {
  return [
    { orderId: 'FND-ORD-8841' },
    { orderId: 'FND-ORD-8610' },
    { orderId: 'FND-ORD-9001' },
  ];
}

export default async function PaymentByIdPage({ params }: PaymentByIdPageProps) {
  const { orderId } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <p className="text-sm font-medium text-slate-400">Loading checkout...</p>
        </div>
      }
    >
      <CheckoutView initialOrderId={orderId} />
    </Suspense>
  );
}