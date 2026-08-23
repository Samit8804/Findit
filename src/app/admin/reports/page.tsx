'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, Trash2, XCircle, Ban } from 'lucide-react';
import { adminReports, AdminReport } from '@/data/adminData';
import { DataTable, Tabs as FilterTabs } from '@/components/ui/Form';
import { Modal, ConfirmDialog, useToast } from '@/components/ui/Feedback';

const REASONS = ['All', 'Spam', 'Scam', 'Fake', 'Duplicate', 'Wrong Category', 'Prohibited Content', 'Other'];

const reasonCls: Record<string, string> = {
  Spam: 'bg-orange-50 text-orange-700',
  Scam: 'bg-red-50 text-[#D32F2F]',
  Fake: 'bg-rose-50 text-rose-700',
  Duplicate: 'bg-sky-50 text-sky-700',
  'Wrong Category': 'bg-violet-50 text-violet-700',
  'Prohibited Content': 'bg-red-50 text-[#B91C1C]',
  Other: 'bg-slate-100 text-slate-600',
};

export default function AdminReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState(adminReports);
  const [filter, setFilter] = useState('All');
  const [viewing, setViewing] = useState<AdminReport | null>(null);
  const [confirm, setConfirm] = useState<{ report: AdminReport; action: string } | null>(null);

  const visible = filter === 'All' ? reports : reports.filter((r) => r.reason === filter);

  const resolve = (report: AdminReport, action: string) => {
    setReports((prev) => prev.filter((r) => r.id !== report.id));
    toast(action === 'Remove' ? `Ad removed â€” ${report.adTitle}` : action === 'Ban User' ? 'User banned' : 'Report dismissed');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Reports</h1>
        <p className="text-xs text-slate-500 mt-1">{reports.length} open report{reports.length !== 1 ? 's' : ''} awaiting review.</p>
      </div>

      <FilterTabs tabs={REASONS} active={filter} onChange={setFilter} />

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <p className="text-sm font-semibold text-slate-500">Queue clear â€” no reports in this category.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((r) => (
            <li key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${reasonCls[r.reason] || reasonCls.Other}`}>
                      {r.reason}
                    </span>
                    <span className="text-[11px] text-slate-400">{r.date}</span>
                  </div>
                  <h3 className="font-bold text-sm">{r.adTitle}</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Reported by <strong className="text-slate-700">{r.reporter}</strong> â€” {r.details}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-1.5 shrink-0 w-full md:w-auto">
                  <button onClick={() => setViewing(r)} title="Review" className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-slate-600 transition-colors">
                    <Eye className="w-4 h-4" /><span className="text-[9px] font-bold">Review</span>
                  </button>
                  <button onClick={() => setConfirm({ report: r, action: 'Remove' })} title="Remove ad" className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl bg-red-50 text-[#E53935] hover:bg-[#E53935] hover:text-white transition-colors">
                    <Trash2 className="w-4 h-4" /><span className="text-[9px] font-bold">Remove</span>
                  </button>
                  <button onClick={() => resolve(r, 'Dismiss')} title="Dismiss" className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors">
                    <XCircle className="w-4 h-4" /><span className="text-[9px] font-bold">Dismiss</span>
                  </button>
                  <button onClick={() => setConfirm({ report: r, action: 'Ban User' })} title="Ban user" className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#D32F2F] text-slate-600 transition-colors">
                    <Ban className="w-4 h-4" /><span className="text-[9px] font-bold">Ban</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={viewing !== null} onClose={() => setViewing(null)} title="Report Details" size="md">
        {viewing && (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Advertisement</dt><dd className="font-semibold text-right">{viewing.adTitle}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Reporter</dt><dd className="font-semibold">{viewing.reporter}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Reason</dt><dd className="font-semibold">{viewing.reason}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Date</dt><dd className="font-semibold">{viewing.date}</dd></div>
            <div className="pt-3 border-t border-slate-100">
              <dt className="text-slate-400 text-xs uppercase tracking-wide font-bold mb-1.5">Details</dt>
              <dd className="text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-4">{viewing.details}</dd>
            </div>
            <Link href="/admin/ads" className="block text-center mt-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:border-[#E53935] hover:text-[#E53935] transition-colors">
              Open advertisement in moderation queue
            </Link>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && resolve(confirm.report, confirm.action)}
        title={confirm?.action || ''}
        message={
          confirm?.action === 'Remove'
            ? `"${confirm?.report.adTitle}" will be removed from the marketplace permanently.`
            : 'The offending account will be banned and all their listings unpublished.'
        }
        confirmLabel={confirm?.action}
        danger
      />
    </div>
  );
}