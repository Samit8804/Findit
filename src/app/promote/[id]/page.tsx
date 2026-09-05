import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import PromoteView from '@/components/promote/PromoteView';
interface PromoteByIdPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return [];
}

export default async function PromoteByIdPage({ params }: PromoteByIdPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <PromoteView initialId={id} />
    </Suspense>
  );
}