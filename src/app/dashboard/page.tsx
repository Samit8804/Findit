'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icons from 'lucide-react';
import { ArrowUpRight, PlusCircle, Clock, ArrowRight } from 'lucide-react';
import { recentActivity } from '@/data/adminData2';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { StatusBadge } from '@/components/dashboard/AdCard';
import type { AdStatus } from '@/lib/adStore';
import { normalizeAdStatus } from '@/lib/adStatus';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getDashboardStats, getMyAds, DashboardStats } from '@/services/ads';

const CARD_DEFS = [
  { key: 'total', label: 'Total Ads', icon: 'LayoutGrid', trend: 'All time', color: '#E53935' },
  { key: 'active', label: 'Active Ads', icon: 'CircleCheck', trend: 'Live on FindIt', color: '#059669' },
  { key: 'pending', label: 'Pending Review', icon: 'Clock', trend: 'Awaiting moderation', color: '#D97706' },
  { key: 'views', label: 'Total Views', icon: 'Eye', trend: 'All listings', color: '#2563EB' },
  { key: 'favorites', label: 'Favorites', icon: 'Heart', trend: 'Received on listings', color: '#DB2777' },
  { key: 'messages', label: 'Messages', icon: 'MessageSquare', trend: 'Buyer enquiries', color: '#7C3AED' },
] as const;

function MiniIcon({ name }: { name?: string | null }) {
  const key = (name || 'Folder') as string;
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }> & Record<string, unknown>>)[key] ||
    Icons.Folder;
  return <Icon className="w-5 h-5" />;
}

function ActivityIcon({ name }: { name?: string | null }) {
  const key = (name || 'Bell') as string;
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }> & Record<string, unknown>>)[key] ||
    Icons.Bell;
  return <Icon className="w-4 h-4" />;
}

const mockRecent: any[] = [];
const mockConversations: any[] = [];
const useRealConversations = () => {
  const [convs, setConvs] = useState<any[] | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    import('@/services/messaging').then(m => m.listConversations().then(list => {
      setConvs(list.slice(0,3).map(c => ({ id: c.id, name: c.otherName, avatarText: c.otherName.slice(0,2).toUpperCase(), online: false, adRef: c.adTitle, unread: c.unread, lastTime: c.lastTime })));
    }).catch(()=>{}));
  }, []);
  return convs;
};

export default function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAds, setRecentAds] = useState<any[] | null>(null);
  const realConvs = useRealConversations();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getDashboardStats().then(setStats).catch(() => {});
    getMyAds()
      .then((ads) =>
        setRecentAds(
          ads.slice(0, 4).map((a) => ({
            id: a.id,
            title: a.title,
            image: a.image || '',
            price: a.price,
            views: a.views,
            enquiries: a.enquiries,
            status: normalizeAdStatus(a.status),
          }))
        )
      )
      .catch(() => {});
  }, []);

  const valueFor = (key: string): string => {
    if (!stats) return '—';
    switch (key) {
      case 'total': return String(stats.total);
      case 'active': return String(stats.active);
      case 'pending': return String(stats.pending);
      case 'views': return stats.views.toLocaleString('en-IN');
      case 'favorites': return stats.favorites.toLocaleString('en-IN');
      case 'messages': return String(stats.messages);
      default: return '—';
    }
  };

  const recent = recentAds;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Welcome back, Demo User</h1>
          <p className="text-sm text-slate-600 mt-1">Here&apos;s what&apos;s happening with your listings today.</p>
        </div>
          <Link
            href="/post-ad"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#D32F2F] hover:bg-[#B71C1C] text-white text-sm font-bold shadow-lg shadow-red-200 transition-colors"
          >
          <PlusCircle className="w-4 h-4" /> Post New Ad
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {CARD_DEFS.map((s) => (
          <div key={s.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.color}14`, color: s.color }}>
              <MiniIcon name={s.icon} />
            </span>
            <p className="text-xl font-black">{valueFor(s.key)}</p>
            <p className="text-[11px] font-semibold text-slate-600 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-slate-600 mt-1.5 flex items-center gap-1 truncate">
              {!isSupabaseConfigured && s.key !== 'pending' ? null : null}
              {s.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Chart — now uses real stats when Supabase configured, fallback to mock */}
      <PerformanceChart stats={stats ? { views: stats.views, enquiries: (stats as any).messages ?? 0, favorites: stats.favorites } : null} />

      {/* Recent ads + messages */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold">Recent Advertisements</h2>
            <Link href="/dashboard/my-ads" className="text-xs font-bold text-[#E53935] hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {(recent || []).length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              {isSupabaseConfigured ? 'No advertisements yet — post your first ad.' : 'Connect Supabase keys to see live data.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(recent || []).map((ad: any) => (
                <li key={ad.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  {ad.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.image} alt="" className="w-14 h-11 rounded-lg object-cover shrink-0 bg-slate-100" />
                  ) : (
                    <span className="w-14 h-11 rounded-lg bg-slate-100 shrink-0" />
                  )}
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-bold truncate">{ad.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ₹{Number(ad.price).toLocaleString('en-IN')} · {Number(ad.views).toLocaleString()} views · {ad.enquiries} enquiries
                    </p>
                  </div>
                  <StatusBadge status={ad.status as AdStatus} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold">Recent Messages</h2>
            <Link href="/dashboard/messages" className="text-xs font-bold text-[#E53935] hover:underline flex items-center gap-1">
              Open Chat <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <ul className="space-y-4">
            {(isSupabaseConfigured ? (realConvs === null ? [] : realConvs) : mockConversations).length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">
                {isSupabaseConfigured ? (realConvs === null ? 'Loading messages…' : 'No messages yet — start a conversation from an ad.') : 'No messages'}
              </li>
            ) : (
              (isSupabaseConfigured ? realConvs! : mockConversations).map((c) => (
              <li key={c.id}>
                <Link href="/dashboard/messages" className="flex items-start gap-3 group">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center font-black text-xs">{c.avatarText}</div>
                    {c.online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold group-hover:text-[#E53935] transition-colors truncate">{c.name}</p>
                      <span className="text-[10px] text-slate-400 shrink-0">{c.lastTime}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{c.adRef}</p>
                    {c.unread > 0 && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#E53935] text-white text-[10px] font-bold">{c.unread} new</span>
                    )}
                  </div>
                </Link>
              </li>
            )))}
          </ul>
        </div>
      </div>
    </div>
  );
}