'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icons from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { recentActivity as mockActivity } from '@/data/adminData2';

const STATS = [
  { key: 'users', label: 'Total Users', value: '84,219', icon: 'Users', trend: '+1,204 this month', color: '#2563EB' },
  { key: 'listings', label: 'Total Listings', value: '132,807', icon: 'Layers', trend: '+3,890 this month', color: '#059669' },
  { key: 'pending', label: 'Pending Listings', value: '342', icon: 'Clock', trend: 'Needs review', color: '#D97706' },
  { key: 'reported', label: 'Reported Listings', value: '58', icon: 'Flag', trend: '+12 today', color: '#E53935' },
  { key: 'revenue', label: 'Monthly Revenue', value: '₹8.4L', icon: 'Wallet', trend: '+18.2% vs last month', color: '#7C3AED' },
  { key: 'featured', label: 'Featured Ads', value: '4,120', icon: 'Rocket', trend: 'Across all categories', color: '#DB2777' },
  { key: 'businesses', label: 'Businesses', value: '1,932', icon: 'Building2', trend: '+86 this month', color: '#0F766E' },
  { key: 'organic', label: 'Organic Traffic', value: '612K', icon: 'TrendingUp', trend: '+9.4% vs last month', color: '#4F46E5' },
] as const;

const CHARTS = [
  { title: 'Revenue (₹ Lakhs)', data: [3.2, 4.1, 3.8, 5.2, 6.1, 7.4, 8.4], color: '#7C3AED' },
  { title: 'New Users (K)', data: [8, 9, 11, 10, 14, 17, 19], color: '#2563EB' },
  { title: 'New Listings (K)', data: [22, 26, 24, 31, 35, 42, 39], color: '#059669' },
  { title: 'Listing Views (M)', data: [1.8, 2.1, 2.0, 2.6, 3.0, 3.6, 3.9], color: '#E53935' },
];

function MiniIcon({ name }: { name: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }> & Record<string, unknown>>)[name] ||
    Icons.Folder;
  return <Icon className="w-5 h-5" />;
}

function ActivityIcon({ name }: { name: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }> & Record<string, unknown>>)[name] ||
    Icons.Bell;
  return <Icon className="w-4 h-4" />;
}

export default function AdminDashboard() {
  const [range, setRange] = useState<'7' | '30' | '90' | '365'>('7');
  const [stats, setStats] = useState<typeof STATS | null>(null);
  const [charts, setCharts] = useState<typeof CHARTS | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const sb = getSupabaseBrowser()!;
      const since = new Date(); since.setDate(since.getDate() - Number(range));
      const iso = since.toISOString();

      const [users, ads, reports, orders] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact' }).gte('created_at', iso),
        sb.from('ads').select('id, status', { count: 'exact' }),
        sb.from('reports').select('id', { count: 'exact' }).gte('created_at', iso),
        sb.from('orders').select('amount, status', { count: 'exact' }).eq('status', 'paid').gte('created_at', iso),
      ]);

      // Aggregate for charts (simple counts per day bucket)
      const revenue = orders.data?.reduce((s: number, o: any) => s + Number(o.amount || 0), 0) || 0;

      setStats([
        { key: 'users', label: 'Total Users', value: String(users.count ?? '—'), icon: 'Users', trend: `${users.count ?? 0} in last ${range}d`, color: '#2563EB' },
        { key: 'listings', label: 'Total Listings', value: String(ads.count ?? '—'), icon: 'Layers', trend: `${ads.data?.filter((a: any) => a.status === 'pending').length ?? 0} pending`, color: '#059669' },
        { key: 'pending', label: 'Pending Listings', value: String(ads.data?.filter((a: any) => a.status === 'pending').length ?? '—'), icon: 'Clock', trend: 'Needs review', color: '#D97706' },
        { key: 'reported', label: 'Reported Listings', value: String(reports.count ?? '—'), icon: 'Flag', trend: 'Last period', color: '#E53935' },
        { key: 'revenue', label: 'Revenue', value: `₹${(revenue / 100000).toFixed(1)}L`, icon: 'Wallet', trend: `${orders.count ?? 0} paid`, color: '#7C3AED' },
        { key: 'featured', label: 'Featured Ads', value: '—', icon: 'Rocket', trend: 'Promotion system', color: '#DB2777' },
        { key: 'businesses', label: 'Businesses', value: '—', icon: 'Building2', trend: 'Directory', color: '#0F766E' },
        { key: 'organic', label: 'Organic Traffic', value: 'GA', icon: 'TrendingUp', trend: 'See GA dashboard', color: '#4F46E5' },
      ] as any);
    })();
  }, [range]);

  const displayStats = stats || STATS;
  const displayCharts = charts || CHARTS;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Admin Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">Platform health — {isSupabaseConfigured ? 'live Supabase data' : 'demo data'}.</p>
        </div>
        <div className="flex gap-1.5">
          {(['7', '30', '90', '365'] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${range === r ? 'bg-[#E53935] text-white border-[#E53935]' : 'bg-white border-slate-200 text-slate-600'}`}>
              {r === '365' ? 'This year' : `${r} days`}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {displayStats.map((s) => (
          <div key={s.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.color}14`, color: s.color }}>
              <MiniIcon name={s.icon} />
            </span>
            <p className="text-xl font-black">{s.value}</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 truncate">
              <ArrowUpRight className="w-3 h-3 shrink-0" style={{ color: s.color }} /> {s.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {displayCharts.map((chart) => {
          const max = Math.max(...chart.data);
          return (
            <div key={chart.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-500 mb-4">{chart.title}</h3>
              <div className="flex items-end justify-between gap-1.5 h-28" role="img" aria-label={chart.title}>
                {chart.data.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 h-full" title={`${v}`}>
                    <div
                      className="w-full max-w-[16px] rounded-t-md transition-all hover:opacity-75"
                      style={{ height: `${(v / max) * 100}%`, background: chart.color, minHeight: 4 }}
                    />
                    <span className="text-[8px] font-semibold text-slate-300">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-3">Last {range} days</p>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-base font-bold mb-5">Recent Activity</h2>
        <ul className="space-y-4">
          {mockActivity.map((a, i) => (
            <li key={i} className="flex items-center gap-3.5">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.color}`}>
                <ActivityIcon name={a.icon} />
              </span>
              <p className="text-sm text-slate-600 flex-grow min-w-0">{a.text}</p>
              <span className="text-[11px] text-slate-400 shrink-0">{a.time}</span>
            </li>
          ))}
        </ul>
        <Link href="/admin/reports" className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#E53935] hover:underline">
          Review pending reports
        </Link>
      </div>
    </div>
  );
}