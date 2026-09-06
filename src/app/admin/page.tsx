'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icons from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

function MiniIcon({ name }: { name?: string | null }) {
  const key = (name || 'Folder') as string;
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }> & Record<string, unknown>>)[key] ||
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

function formatINR(value: number): string {
  if (value === 0) return '₹0';
  if (value < 1000) return `₹${value}`;
  if (value < 100000) return `₹${value.toLocaleString('en-IN')}`;
  if (value < 10000000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${(value / 10000000).toFixed(2)}Cr`;
}

export default function AdminDashboard() {
  const [range, setRange] = useState<'7' | '30' | '90' | '365'>('7');
  const [stats, setStats] = useState<any[] | null>(null);
  const [charts, setCharts] = useState<any[] | null>(null);
  const [activity, setActivity] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase not configured — dashboard data unavailable');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const sb = getSupabaseBrowser()!;
        const since = new Date(); since.setDate(since.getDate() - Number(range));
        const sinceIso = since.toISOString();
        const now = new Date();

        // Real queries for each metric
        const [totalUsersRes, newUsersRes, totalAdsRes, pendingRes, approvedRes, rejectedRes, reportsRes, ordersRes, featuredRes, businessesRes, gaRes] = await Promise.all([
          sb.from('profiles').select('id', { count: 'exact', head: true }),
          sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso),
          sb.from('ads').select('id', { count: 'exact', head: true }),
          sb.from('ads').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          sb.from('ads').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
          sb.from('ads').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
          sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
          sb.from('orders').select('amount', { count: 'exact' }).eq('status', 'paid').gte('created_at', sinceIso),
          sb.from('ad_promotions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          sb.from('business_profiles').select('id', { count: 'exact', head: true }),
          // GA - check if configured, otherwise not connected
          Promise.resolve({ count: null } as any),
        ]);

        if (cancelled) return;

        if (totalUsersRes.error) throw totalUsersRes.error;
        if (totalAdsRes.error) throw totalAdsRes.error;

        const totalUsers = totalUsersRes.count ?? 0;
        const newUsers = newUsersRes.count ?? 0;
        const totalAds = totalAdsRes.count ?? 0;
        const pending = pendingRes.count ?? 0;
        const approved = approvedRes.count ?? 0;
        const rejected = rejectedRes.count ?? 0;
        const reported = reportsRes.count ?? 0;
        const revenue = ordersRes.data?.reduce((s: number, o: any) => s + Number(o.amount || 0), 0) || 0;
        const paidCount = ordersRes.count ?? 0;
        const featured = featuredRes.count ?? 0;
        const businesses = businessesRes.count ?? 0;

        // Check for query errors on revenue/orders specifically (if table missing)
        if (ordersRes.error && !ordersRes.error.message.includes('does not exist')) throw ordersRes.error;

        setStats([
          { key: 'users', label: 'Total Users', value: String(totalUsers), icon: 'Users', trend: `+${newUsers} in last ${range}d`, color: '#2563EB', raw: totalUsers },
          { key: 'listings', label: 'Total Listings', value: String(totalAds), icon: 'Layers', trend: `${pending} pending`, color: '#059669', raw: totalAds },
          { key: 'pending', label: 'Pending Listings', value: String(pending), icon: 'Clock', trend: 'Needs review', color: '#D97706', raw: pending },
          { key: 'reported', label: 'Reported Listings', value: String(reported), icon: 'Flag', trend: 'Unresolved reports', color: '#E53935', raw: reported },
          { key: 'revenue', label: 'Revenue', value: formatINR(revenue), icon: 'Wallet', trend: `${paidCount} paid`, color: '#7C3AED', raw: revenue },
          { key: 'featured', label: 'Featured Ads', value: String(featured), icon: 'Rocket', trend: 'Active promotions', color: '#DB2777', raw: featured },
          { key: 'businesses', label: 'Businesses', value: String(businesses), icon: 'Building2', trend: 'Total', color: '#0F766E', raw: businesses },
          { key: 'organic', label: 'Organic Traffic', value: 'Not connected', icon: 'TrendingUp', trend: 'Connect Analytics', color: '#4F46E5', raw: null },
        ]);

        // Real charts: group by date
        const days = Number(range) === 365 ? 12 : Number(range);
        // Revenue per day
        const revenueByDay = new Map<string, number>();
        const usersByDay = new Map<string, number>();
        const listingsByDay = new Map<string, number>();
        // For simplicity, fetch raw rows for time series (limited to 1000)
        const [revRows, userRows, listingRows] = await Promise.all([
          sb.from('orders').select('created_at, amount').eq('status', 'paid').gte('created_at', sinceIso).limit(1000),
          sb.from('profiles').select('created_at').gte('created_at', sinceIso).limit(1000),
          sb.from('ads').select('created_at').gte('created_at', sinceIso).limit(1000),
        ]);
        // Views - check if column exists, otherwise 0
        let viewsByDay = new Map<string, number>();
        try {
          const { data: viewRows } = await sb.from('ads').select('views_count, created_at').gte('created_at', sinceIso).limit(1000);
          // Distribute views evenly or skip
        } catch {}

        const formatKey = (d: Date) => {
          if (Number(range) === 365) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          return d.toISOString().slice(0,10);
        };
        (revRows.data || []).forEach((r: any) => {
          const k = formatKey(new Date(r.created_at));
          revenueByDay.set(k, (revenueByDay.get(k) || 0) + Number(r.amount || 0));
        });
        (userRows.data || []).forEach((r: any) => {
          const k = formatKey(new Date(r.created_at));
          usersByDay.set(k, (usersByDay.get(k) || 0) + 1);
        });
        (listingRows.data || []).forEach((r: any) => {
          const k = formatKey(new Date(r.created_at));
          listingsByDay.set(k, (listingsByDay.get(k) || 0) + 1);
        });

        const labels: string[] = [];
        const revData: number[] = [];
        const userData: number[] = [];
        const listingData: number[] = [];
        const viewsData: number[] = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now);
          if (Number(range) === 365) d.setMonth(d.getMonth() - i);
          else d.setDate(d.getDate() - i);
          const k = formatKey(d);
          labels.push(Number(range) === 365 ? d.toLocaleDateString('en-IN', { month: 'short' }) : d.toLocaleDateString('en-IN', { weekday: 'short' }).slice(0,3));
          revData.push(Math.round((revenueByDay.get(k) || 0) / 100000 * 10) / 10); // in Lakhs
          userData.push(usersByDay.get(k) || 0);
          listingData.push(listingsByDay.get(k) || 0);
          viewsData.push(0); // Views not tracked per day yet
        }

        setCharts([
          { title: 'Revenue (₹ Lakhs)', data: revData, color: '#7C3AED' },
          { title: 'New Users', data: userData, color: '#2563EB' },
          { title: 'New Listings', data: listingData, color: '#059669' },
          { title: 'Listing Views', data: viewsData, color: '#E53935', emptyNote: 'View tracking not available yet' },
        ]);

        // Recent activity from audit logs
        try {
          const { data: logs } = await sb.from('admin_audit_logs').select('action, entity_type, created_at').order('created_at', { ascending: false }).limit(5);
          if (logs && logs.length > 0 && !cancelled) {
            setActivity(logs.map((l: any) => ({
              icon: l.action?.includes('APPROVED') ? 'Layers' : l.action?.includes('PAYMENT') ? 'Wallet' : l.action?.includes('USER') ? 'Users' : 'Flag',
              text: `${l.action} ${l.entity_type} ${l.entity_id?.slice(0,8) || ''}`,
              time: new Date(l.created_at).toLocaleDateString('en-IN'),
              color: 'text-slate-600 bg-slate-100',
            })));
          } else if (!cancelled) {
            setActivity([]);
          }
        } catch {
          if (!cancelled) setActivity([]);
        }

      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Unable to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-40 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-slate-100 mb-3" />
              <div className="h-6 w-12 bg-slate-100 rounded mb-2" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
        <p className="text-sm font-semibold text-[#D32F2F]">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold">Retry</button>
      </div>
    );
  }

  const displayStats = stats || [];
  const displayCharts = charts || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">Platform health — live Supabase data.</p>
        </div>
        <div className="flex gap-1.5">
          {(['7', '30', '90', '365'] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${range === r ? 'bg-[#E53935] text-white border-[#E53935]' : 'bg-white border-slate-200 text-slate-700'}`}>
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
            <p className="text-3xl font-bold text-slate-900">{s.value}</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">{s.label}</p>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1 truncate">
              <ArrowUpRight className="w-3 h-3 shrink-0" style={{ color: s.color }} /> {s.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {displayCharts.map((chart) => {
          const max = Math.max(...chart.data, 1);
          const isEmpty = chart.data.every((v: number) => v === 0);
          return (
            <div key={chart.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-900 mb-4">{chart.title}</h3>
              {isEmpty ? (
                <div className="h-28 flex items-center justify-center text-xs text-slate-500">
                  {chart.title.includes('Views') && (chart as any).emptyNote ? (chart as any).emptyNote : 'No data for this period'}
                </div>
              ) : (
                <div className="flex items-end justify-between gap-1.5 h-28" role="img" aria-label={chart.title}>
                  {chart.data.map((v: number, i: number) => (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 h-full" title={`${v}`}>
                      <div
                        className="w-full max-w-[16px] rounded-t-md transition-all hover:opacity-75"
                        style={{ height: `${(v / max) * 100}%`, background: chart.color, minHeight: 4 }}
                      />
                      <span className="text-[8px] font-semibold text-slate-500">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-3">Last {range} days</p>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-5">Recent Activity</h2>
        {activity === null ? (
          <p className="text-sm text-slate-500">Loading activity...</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-slate-500">No recent activity</p>
        ) : (
          <ul className="space-y-4">
            {activity.map((a, i) => (
              <li key={i} className="flex items-center gap-3.5">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a?.color || 'bg-slate-100 text-slate-600'}`}>
                  <ActivityIcon name={a?.icon} />
                </span>
                <p className="text-sm text-slate-700 flex-grow min-w-0">{a?.text || 'Activity'}</p>
                <span className="text-[11px] text-slate-500 shrink-0">{a?.time || ''}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/audit-logs" className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#E53935] hover:underline">
          Review audit logs
        </Link>
      </div>
    </div>
  );
}
