'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

interface Stats {
  views: number;
  favorites: number;
  messages: number;
  active: number;
  sold: number;
}

export default function SellerAnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [range, setRange] = useState<'7' | '30' | '90' | '365'>('30');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = getSupabaseBrowser();
      if (!sb) { setLoading(false); return; }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setLoading(false); return; }

      const since = new Date();
      since.setDate(since.getDate() - Number(range));

      // Seller ad performance
      const { data: ads } = await sb
        .from('ads')
        .select('id, title, price, status, views_count, favorites_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Favorites received via analytics
      const { data: favEvents } = await sb
        .from('analytics_events')
        .select('entity_id')
        .eq('event_name', 'ad_favorite')
        .gte('created_at', since.toISOString());

      // Messages received (joined via ads)
      const adIds = (ads || []).map((a: any) => a.id);
      let msgCount = 0;
      if (adIds.length > 0) {
        const { count } = await sb
          .from('messages')
          .select('id', { count: 'exact' })
          .in('conversation_id', (await sb.from('conversations').select('id').in('ad_id', adIds)).data?.map((c: any) => c.id) || []);
        msgCount = count || 0;
      }

      const totalViews = (ads || []).reduce((s: number, a: any) => s + (a.views_count || 0), 0);
      const totalFav = favEvents?.length || 0;

      setStats({
        views: totalViews,
        favorites: totalFav,
        messages: msgCount,
        active: (ads || []).filter((a: any) => a.status === 'approved').length,
        sold: (ads || []).filter((a: any) => a.status === 'sold').length,
      });

      setRows(ads || []);
      setLoading(false);
    })();
  }, [range]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-white border border-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">Real performance of your advertisements — verified ownership only.</p>
        </div>
        <div className="flex gap-1.5">
          {(['7', '30', '90', '365'] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${range === r ? 'bg-[#E53935] text-white border-[#E53935]' : 'bg-white border-slate-200 text-slate-600'}`}>
              {r === '365' ? 'This year' : `${r} days`}
            </button>
          ))}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Views', value: stats?.views ?? 0 },
          { label: 'Favorites', value: stats?.favorites ?? 0 },
          { label: 'Messages', value: stats?.messages ?? 0 },
          { label: 'Active Ads', value: stats?.active ?? 0 },
          { label: 'Sold Ads', value: stats?.sold ?? 0 },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-black mt-2">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Ad performance table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="pl-5 pr-3 py-3.5">Advertisement</th>
              <th className="px-3 py-3.5">Views</th>
              <th className="px-3 py-3.5">Favorites</th>
              <th className="px-3 py-3.5">Messages</th>
              <th className="pr-5 pl-3 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 20).map((ad) => (
              <tr key={ad.id} className="hover:bg-slate-50/60">
                <td className="pl-5 pr-3 py-3.5">
                  <a href={`/dashboard/ads/${ad.id}/analytics`} className="font-bold hover:text-[#E53935] line-clamp-1 max-w-[280px]">{ad.title}</a>
                  <span className="text-[11px] text-slate-400">₹{Number(ad.price).toLocaleString('en-IN')}</span>
                </td>
                <td className="px-3 py-3.5">{ad.views_count}</td>
                <td className="px-3 py-3.5">—</td>
                <td className="px-3 py-3.5">—</td>
                <td className="pr-5 pl-3 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${ad.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{ad.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-10 text-center text-sm text-slate-400">No advertisements yet.</p>}
      </div>
    </div>
  );
}
