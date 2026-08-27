'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, CircleCheck, Clock, XCircle, RotateCcw, TrendingUp } from 'lucide-react';
import { DataTable } from '@/components/ui/Form';
import { Tabs } from '@/components/ui/Form';
import {
  adminGetOrders,
  getRevenueStats,
  RevenueStats,
  AdminOrderRow,
} from '@/services/payments';
import { isSupabaseConfigured } from '@/lib/supabase/client';

const STATUS_TABS = ['All', 'paid', 'pending', 'created', 'failed', 'refunded'];

function badge(status: string) {
  switch (status) {
    case 'paid': return 'bg-emerald-50 text-emerald-700';
    case 'pending': case 'created': return 'bg-amber-50 text-amber-700';
    case 'failed': return 'bg-red-50 text-[#D32F2F]';
    case 'refunded': case 'partially_refunded': return 'bg-sky-50 text-sky-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const [o, s] = await Promise.all([adminGetOrders('All'), getRevenueStats()]);
      setOrders(o);
      setStats(s);
    } catch {
      /* error state below */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = filter === 'All' ? orders : orders.filter((o) => o.status === filter);

  const cards = [
    { label: "Today's Revenue", value: stats ? `₹${stats.today.toLocaleString('en-IN')}` : '—', icon: Wallet, cls: 'bg-red-50 text-[#E53935]' },
    { label: 'This Month', value: stats ? `₹${stats.month.toLocaleString('en-IN')}` : '—', icon: TrendingUp, cls: 'bg-violet-50 text-violet-600' },
    { label: 'Paid Orders', value: stats ? String(stats.paidCount) : '—', icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Failed', value: stats ? String(stats.failedCount) : '—', icon: XCircle, cls: 'bg-red-50 text-[#D32F2F]' },
    { label: 'Refunded', value: stats ? String(stats.refundedCount) : '—', icon: RotateCcw, cls: 'bg-sky-50 text-sky-600' },
    { label: 'Total Revenue', value: stats ? `₹${stats.total.toLocaleString('en-IN')}` : '—', icon: Wallet, cls: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Payments</h1>
          <p className="text-xs text-slate-500 mt-1">Verified revenue and transactions across all promotions.</p>
        </div>
        <button onClick={() => void load()} className="shrink-0 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold hover:border-slate-300 transition-colors">
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.cls}`}>
              <c.icon className="w-4 h-4" />
            </span>
            <p className="text-lg font-black">{c.value}</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5 leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      <Tabs tabs={STATUS_TABS.map((t) => t.charAt(0).toUpperCase() + t.slice(1))} active={filter.charAt(0).toUpperCase() + filter.slice(1)} onChange={(v) => setFilter(v.toLowerCase())} />

      {loading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-white border border-slate-100 rounded-2xl" />)}
        </div>
      ) : !isSupabaseConfigured ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-100">
          <p className="text-sm font-semibold text-slate-500">Connect Supabase keys to view real payment data.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">No payments in this status.</p>
        </div>
      ) : (
        <DataTable headers={['Order ID', 'User', 'Advertisement', 'Product', 'Amount', 'Provider', 'Status', 'Date']}>
          {visible.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="pl-5 pr-3 py-3.5 font-mono text-xs font-bold">{o.id.slice(0, 8)}…</td>
              <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap max-w-[160px] truncate">{o.user_email ?? '—'}</td>
              <td className="px-3 py-3.5 text-slate-500 max-w-[200px] truncate">{o.adTitle}</td>
              <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{o.productName}</td>
              <td className="px-3 py-3.5 font-bold whitespace-nowrap">₹{o.amount.toLocaleString('en-IN')}</td>
              <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap capitalize">{o.provider}</td>
              <td className="px-3 py-3.5">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${badge(o.status)}`}>{o.status}</span>
              </td>
              <td className="pr-5 pl-3 py-3.5 text-slate-500 whitespace-nowrap">{o.date}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}