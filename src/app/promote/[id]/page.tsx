import React, { Suspense } from 'react';
import PromoteAdView from '@/components/promote/PromoteAdView';
import { mockListings } from '@/data/mockData';
import { demoAds } from '@/data/accountData';

interface PromoteByIdPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  const ids = new Set<string>([
    ...mockListings.map((l) => l.id),
    ...demoAds.map((d) => d.id),
  ]);
  return Array.from(ids).map((id) => ({ id }));
}

export default async function PromoteByIdPage({ params }: PromoteByIdPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <p className="text-sm font-medium text-slate-400">Loading promotion options...</p>
        </div>
      }
    >
      <PromoteAdView initialId={id} />
    </Suspense>
  );
}