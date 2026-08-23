import { StatCardSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="h-5 w-48 rounded bg-slate-200 mb-6" />
        <div className="flex items-end justify-between gap-3 h-40">
          {[60, 80, 50, 90, 75, 95, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-slate-200/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}