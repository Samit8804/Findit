'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export default function AdAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const adId = params.id;
  const [ad, setAd] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [series, setSeries] = useState<{ date: string; views: number; favorites: number; messages: number }[]>([]);

  useEffect(() => {
    (async () => {
      const sb = getSupabaseBrowser();
      if (!sb) { setError('Connect Supabase keys to view real analytics.'); setLoading(false); return; }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setError('Please log in.'); setLoading(false); return; }

      const { data: adRow, error: adErr } = await sb.from('ads').select('id, title, price, status, user_id, views_count, favorites_count').eq('id', adId).single();
      if (adErr || !adRow) { setError('Advertisement not found.'); setLoading(false); return; }
      if (adRow.user_id !== user.id) { setError("You don't have permission to view this advertisement's analytics."); setLoading(false); return; }
      setAd(adRow);

      // Daily stats last 30 days
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data: daily } = await sb.from('daily_ad_stats').select('*').eq('ad_id', adId).gte('date', since.toISOString().slice(0, 10)).order('date');
      setSeries((daily || []).map((d: any) => ({ date: d.date, views: d.views, favorites: d.favorites, messages: d.messages })));
      setLoading(false);
    })();
  }, [adId]);

  if (loading) return <div className="p-8 animate-pulse"><div className="h-8 w-48 bg-slate-200 rounded mb-6" /><div className="h-64 bg-white border border-slate-100 rounded-2xl" /></div>;
  if (error) return <div className="p-8"><p className="text-sm font-semibold text-[#D32F2F]">{error}</p><Link href="/dashboard/analytics" className="text-xs text-[#E53935] underline mt-3 inline-block">Back to analytics</Link></div>;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/analytics" className="text-xs font-bold text-[#E53935] hover:underline">← Back to analytics</Link>
      <div>
        <h1 className="text-xl font-black tracking-tight">{ad.title}</h1>
        <p className="text-xs text-slate-500 mt-1">₹{Number(ad.price).toLocaleString('en-IN')} · Status: <span className="font-bold">{ad.status}</span></p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Views', value: ad.views_count },
          { label: 'Favorites', value: ad.favorites_count },
          { label: 'Status', value: ad.status },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-black mt-2">{String(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-sm font-bold mb-4">Last 30 Days</h2>
        {series.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">No daily stats yet. Views are aggregated nightly.</p>
        ) : (
          <div className="flex items-end gap-1.5 h-40">
            {series.map((d) => {
              const max = Math.max(...series.map((x) => x.views), 1);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-[#E53935] rounded-t-md" style={{ height: `${(d.views / max) * 100}%`, minHeight: 4 }} title={`${d.date}: ${d.views} views`} />
                  <span className="text-[8px] text-slate-300 rotate-45 origin-left">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
