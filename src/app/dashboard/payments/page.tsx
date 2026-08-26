'use client';

import React, { useEffect, useState } from 'react';
import { Wallet, CircleCheck, Clock, TrendingUp } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getMyPaymentHistory, PaymentHistoryRow } from '@/services/payments';

function statusBadge(status: string) {
  switch (status) {
    case 'paid': case 'Success': return 'bg-emerald-50 text-emerald-700';
    case 'pending': case 'created': case 'Pending': return 'bg-amber-50 text-amber-700';
    case 'refunded': case 'partially_refunded': return 'bg-sky-50 text-sky-700';
    default: return 'bg-red-50 text-[#D32F2F]';
  }
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    getMyPaymentHistory()
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const paidRows = rows.filter((p) => p.status === 'paid');
  const total = paidRows.reduce((s, p) => s + p.amount, 0);
  const pendingCount = rows.filter((p) => p.status === 'pending' || p.status === 'created').length;

  const cards = [
    { label: 'Total Spending', value: `₹${total.toLocaleString('en-IN')}`, icon: Wallet, cls: 'bg-red-50 text-[#E53935]' },
    { label: 'Successful Payments', value: String(paidRows.length), icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pending Payments', value: String(pendingCount), icon: Clock, cls: 'bg-amber-50 text-amber-600' },
    { label: 'Promotions Active', value: '—', icon: TrendingUp, cls: 'bg-sky-50 text-sky-600' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Payments</h1>
        <p className="text-xs text-slate-500 mt-1">Your promotion orders and spending history.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.cls}`}>
              <c.icon className="w-5 h-5" />
            </span>
            <p className="text-xl font-black">{c.value}</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* History */}
      {loading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-white border border-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">No payments yet.</p>
          <p className="text-xs text-slate-400 mt-1">Promotion purchases will appear here with verified status only.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="pl-5 pr-3 py-3.5 font-bold">Order ID</th>
                  <th className="px-3 py-3.5 font-bold">Advertisement</th>
                  <th className="px-3 py-3.5 font-bold">Product</th>
                  <th className="px-3 py-3.5 font-bold">Amount</th>
                  <th className="px-3 py-3.5 font-bold">Date</th>
                  <th className="pr-5 pl-3 py-3.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="pl-5 pr-3 py-3.5 font-mono text-xs font-bold">{p.orderId}…</td>
                    <td className="px-3 py-3.5 text-slate-600 max-w-[220px] truncate">{p.adTitle}</td>
                    <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{p.productName}</td>
                    <td className="px-3 py-3.5 font-bold whitespace-nowrap">₹{p.amount.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{p.date}</td>
                    <td className="pr-5 pl-3 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${statusBadge(p.status)}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden divide-y divide-slate-100 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {rows.map((p) => (
              <li key={p.id} className="p-4">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="font-mono text-xs font-bold">{p.orderId}…</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(p.status)}`}>{p.status}</span>
                </div>
                <p className="text-sm font-semibold text-slate-700 truncate">{p.adTitle}</p>
                <p className="text-xs text-slate-400 mt-0.5">{p.productName}</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="font-black">₹{p.amount.toLocaleString('en-IN')}</span>
                  <span className="text-slate-400">{p.date}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}