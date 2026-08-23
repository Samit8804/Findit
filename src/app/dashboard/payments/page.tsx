'use client';

import React from 'react';
import { Wallet, CircleCheck, Clock, TrendingUp } from 'lucide-react';
import { payments } from '@/data/accountData';

function statusBadge(status: string) {
  switch (status) {
    case 'Success':
      return 'bg-emerald-50 text-emerald-700';
    case 'Pending':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-red-50 text-[#D32F2F]';
  }
}

export default function PaymentsPage() {
  const total = payments.filter((p) => p.status === 'Success').reduce((s, p) => s + p.amount, 0);
  const successCount = payments.filter((p) => p.status === 'Success').length;
  const pendingCount = payments.filter((p) => p.status === 'Pending').length;

  const cards = [
    { label: 'Total Spending', value: `₹${total.toLocaleString('en-IN')}`, icon: Wallet, cls: 'bg-red-50 text-[#E53935]' },
    { label: 'Successful Payments', value: String(successCount), icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pending Payments', value: String(pendingCount), icon: Clock, cls: 'bg-amber-50 text-amber-600' },
    { label: 'Promotions Active', value: '2', icon: TrendingUp, cls: 'bg-sky-50 text-sky-600' },
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

      {/* History table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold">Payment History</h2>
        </div>

        {/* Desktop table */}
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-6 py-3.5 font-bold">Order ID</th>
              <th className="px-3 py-3.5 font-bold">Advertisement</th>
              <th className="px-3 py-3.5 font-bold">Promotion</th>
              <th className="px-3 py-3.5 font-bold">Amount</th>
              <th className="px-3 py-3.5 font-bold">Date</th>
              <th className="px-6 py-3.5 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.orderId} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-3.5 font-mono text-xs font-bold text-[#0F172A]">{p.orderId}</td>
                <td className="px-3 py-3.5 text-slate-600 max-w-[200px] truncate">{p.adTitle}</td>
                <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{p.promotion}</td>
                <td className="px-3 py-3.5 font-bold whitespace-nowrap">₹{p.amount}</td>
                <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{p.date}</td>
                <td className="px-6 py-3.5">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${statusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <ul className="md:hidden divide-y divide-slate-100">
          {payments.map((p) => (
            <li key={p.orderId} className="p-4">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="font-mono text-xs font-bold">{p.orderId}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(p.status)}`}>{p.status}</span>
              </div>
              <p className="text-sm font-semibold text-slate-700 truncate">{p.adTitle}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.promotion}</p>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="font-black">₹{p.amount}</span>
                <span className="text-slate-400">{p.date}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}