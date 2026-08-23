'use client';

import React from 'react';
import { Wallet, CircleCheck, Clock, XCircle, RotateCcw } from 'lucide-react';
import { adminPayments } from '@/data/adminData2';
import { DataTable } from '@/components/ui/Form';

function badge(status: string) {
  switch (status) {
    case 'Success': return 'bg-emerald-50 text-emerald-700';
    case 'Pending': return 'bg-amber-50 text-amber-700';
    case 'Failed': return 'bg-red-50 text-[#D32F2F]';
    default: return 'bg-sky-50 text-sky-700';
  }
}

export default function AdminPaymentsPage() {
  const success = adminPayments.filter((p) => p.status === 'Success');
  const todayRevenue = 117;
  const monthRevenue = success.reduce((s, p) => s + p.amount, 0);
  const failed = adminPayments.filter((p) => p.status === 'Failed').length;
  const refunds = adminPayments.filter((p) => p.status === 'Refunded').length;

  const cards = [
    { label: "Today's Revenue", value: `₹${todayRevenue.toLocaleString('en-IN')}`, icon: Wallet, cls: 'bg-red-50 text-[#E53935]' },
    { label: 'Monthly Revenue', value: `₹${monthRevenue.toLocaleString('en-IN')}`, icon: TrendingIcon, cls: 'bg-violet-50 text-violet-600' },
    { label: 'Successful Payments', value: String(success.length), icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pending Payments', value: String(adminPayments.filter((p) => p.status === 'Pending').length), icon: Clock, cls: 'bg-amber-50 text-amber-600' },
    { label: 'Failed Payments', value: String(failed), icon: XCircle, cls: 'bg-red-50 text-[#D32F2F]' },
    { label: 'Refunds', value: String(refunds), icon: RotateCcw, cls: 'bg-sky-50 text-sky-600' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Payments</h1>
        <p className="text-xs text-slate-500 mt-1">Transaction analytics across all promotions and plans.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.cls}`}>
              <c.icon className="w-4.5 h-4.5" />
            </span>
            <p className="text-lg font-black">{c.value}</p>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5 leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      <DataTable headers={['Order ID', 'User', 'Advertisement', 'Amount', 'Method', 'Status', 'Date']}>
        {adminPayments.map((p) => (
          <tr key={p.orderId} className="hover:bg-slate-50/60 transition-colors">
            <td className="pl-5 pr-3 py-3.5 font-mono text-xs font-bold">{p.orderId}</td>
            <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap">{p.user}</td>
            <td className="px-3 py-3.5 text-slate-500 max-w-[220px] truncate">{p.advertisement}</td>
            <td className="px-3 py-3.5 font-bold whitespace-nowrap">₹{p.amount.toLocaleString('en-IN')}</td>
            <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{p.method}</td>
            <td className="px-3 py-3.5">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${badge(p.status)}`}>{p.status}</span>
            </td>
            <td className="pr-5 pl-3 py-3.5 text-slate-500 whitespace-nowrap">{p.date}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

function TrendingIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <path d="M23 6l-9.5 9.5-5-5L1 18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}