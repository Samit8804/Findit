import React, { Suspense } from 'react';
import AdDetailView from '@/components/ad/AdDetailView';

interface AdPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AdPageProps) {
  const { slug } = await params;
  return {
    title: decodeURIComponent(slug).replace(/-/g, ' '),
  };
}

export default function AdPage({ params }: AdPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <p className="text-sm font-medium text-slate-400">Loading advertisement...</p>
        </div>
      }
    >
      <AdDetailViewWrapper slugPromise={params} />
    </Suspense>
  );
}

function AdDetailViewWrapper({ slugPromise }: { slugPromise: Promise<{ slug: string }> }) {
  // Client component reads the slug itself via useParams; this wrapper
  // simply suspends until the router is ready.
  void slugPromise;
  return <AdDetailView />;
}