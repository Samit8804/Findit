'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, XCircle, Ban, Pencil } from 'lucide-react';
import { adminBusinesses } from '@/data/adminData2';
import { DataTable, Tabs as FilterTabs } from '@/components/ui/Form';
import { ConfirmDialog, useToast } from '@/components/ui/Feedback';

export default function AdminBusinessesPage() {
  const toast = useToast();
  const [rows, setRows] = useState(adminBusinesses);
  const [filter, setFilter] = useState('All');
  const [confirm, setConfirm] = useState<{ name: string; action: string } | null>(null);

  const visible = filter === 'All' ? rows : rows.filter((b) => b.status === filter);

  const act = (name: string, action: string) => {
    setRows((prev) =>
      prev.map((b) =>
        b.name === name
          ? {
              ...b,
              verified: action === 'Verify' ? true : b.verified,
              status: action === 'Reject' || action === 'Suspend' ? 'Suspended' : 'Active',
            }
          : b
      )
    );
    toast(`${action} â€” ${name}`);
  };

  const subCls: Record<string, string> = {
    'BUSINESS PRO': 'bg-violet-50 text-violet-700',
    BUSINESS: 'bg-sky-50 text-sky-700',
    FREE: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Businesses</h1>
        <p className="text-xs text-slate-700 mt-1">{rows.length} registered businesses</p>
      </div>

      <FilterTabs tabs={['All', 'Active', 'Pending Review', 'Suspended']} active={filter} onChange={setFilter} />

      <DataTable headers={['Business', 'Owner', 'Category', 'Location', 'Verified', 'Listings', 'Plan', 'Status', 'Actions']}>
        {visible.map((b) => (
          <tr key={b.slug} className="hover:bg-slate-50/60 transition-colors">
            <td className="pl-5 pr-3 py-3.5">
              <Link href={`/business/${b.slug}`} className="font-bold hover:text-[#E53935] transition-colors line-clamp-1 max-w-[220px]">
                {b.name}
              </Link>
            </td>
            <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap">{b.owner}</td>
            <td className="px-3 py-3.5 text-slate-700 whitespace-nowrap">{b.category}</td>
            <td className="px-3 py-3.5 text-slate-700 whitespace-nowrap">{b.location}</td>
            <td className="px-3 py-3.5">
              {b.verified ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500" aria-label="Verified" />
              ) : (
                <span className="text-xs text-slate-600">â€”</span>
              )}
            </td>
            <td className="px-3 py-3.5 text-slate-600">{b.listings}</td>
            <td className="px-3 py-3.5">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${subCls[b.subscription]}`}>{b.subscription}</span>
            </td>
            <td className="px-3 py-3.5">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${
                b.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : b.status === 'Pending Review' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-[#D32F2F]'
              }`}>{b.status}</span>
            </td>
            <td className="pr-5 pl-3 py-3.5">
              <div className="flex items-center gap-1">
                {!b.verified && (
                  <button onClick={() => act(b.name, 'Verify')} title="Verify" className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors"><ShieldCheck className="w-4 h-4" /></button>
                )}
                <button onClick={() => setConfirm({ name: b.name, action: 'Reject' })} title="Reject" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-slate-700 transition-colors"><XCircle className="w-4 h-4" /></button>
                <button onClick={() => setConfirm({ name: b.name, action: 'Suspend' })} title="Suspend" disabled={b.status === 'Suspended'} className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-700 text-slate-700 disabled:opacity-40 transition-colors"><Ban className="w-4 h-4" /></button>
                <Link href={`/business/${b.slug}`} title="Edit / View profile" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-700 transition-colors"><Pencil className="w-4 h-4" /></Link>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && act(confirm.name, confirm.action)}
        title={`${confirm?.action} business?`}
        message={`"${confirm?.name}" will be marked as suspended pending review.`}
        confirmLabel={confirm?.action}
        danger={confirm?.action === 'Reject'}
      />
    </div>
  );
}