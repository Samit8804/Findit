import { SearchResultsSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans">
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200" />
            <div className="w-24 h-6 rounded-lg bg-slate-200" />
          </div>
          <div className="hidden lg:flex gap-6">
            {[64, 80, 90, 84].map((w, i) => (
              <div key={i} className="h-4 rounded bg-slate-200" style={{ width: w }} />
            ))}
          </div>
          <div className="w-32 h-10 rounded-xl bg-red-200/70" />
        </div>
      </div>

      <main className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-2 mb-8">
          <div className="h-9 w-56 rounded-lg bg-slate-200" />
          <div className="h-4 w-72 rounded bg-slate-200" />
        </div>
        {/* Drill-down panel skeleton */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-8 animate-pulse grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-16 rounded bg-slate-200 mb-2" />
              <div className="h-11 rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
        <SearchResultsSkeleton />
      </main>
    </div>
  );
}