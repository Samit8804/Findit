import { BusinessCardSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      <div className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-slate-100 pt-12 pb-12">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center animate-pulse">
          <div className="w-64 h-10 rounded-lg bg-slate-200 mb-4" />
          <div className="w-96 h-11 rounded-xl bg-slate-200" />
        </div>
      </div>
      <main className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-6 w-44 rounded-lg bg-slate-200 mb-5 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <BusinessCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}