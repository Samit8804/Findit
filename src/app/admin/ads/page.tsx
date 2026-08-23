'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Check, X, Pencil, Rocket, Trash2 } from 'lucide-react';
import { DataTable, Select, Tabs as FilterTabs } from '@/components/ui/Form';
import { Modal, ConfirmDialog, useToast } from '@/components/ui/Feedback';
import {
  adminListAds,
  moderateAd,
  AdminAdRow,
} from '@/services/ads';

const FILTERS = ['Pending', 'Approved', 'Rejected', 'Reported', 'Expired', 'Sold', 'Draft'];

const REJECTION_REASONS = [
  'Incorrect category',
  'Missing information',
  'Duplicate advertisement',
  'Suspicious content',
  'Prohibited content',
  'Poor quality',
  'Other',
];

function badgeCls(status: string) {
  switch (status) {
    case 'approved': case 'Active': return 'bg-emerald-50 text-emerald-700';
    case 'pending': case 'Pending': return 'bg-amber-50 text-amber-700';
    case 'rejected': case 'Rejected': return 'bg-red-50 text-[#D32F2F]';
    case 'reported': case 'Reported': return 'bg-orange-50 text-orange-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export default function AdminAdsPage() {
  const toast = useToast();
  const [ads, setAds] = useState<AdminAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('Pending');
  const [viewing, setViewing] = useState<AdminAdRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminAdRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminAdRow | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setAds(await adminListAds('All'));
    } catch {
      setLoadError('Unable to load advertisements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = filter === 'All' ? ads : ads.filter((a) => a.status === filter || a.status === filter.toLowerCase());

  const act = async (ad: AdminAdRow, action: 'approve' | 'reject' | 'delete') => {
    try {
      if (action === 'delete') {
        const { setAdStatus } = await import('@/services/ads');
        await setAdStatus(ad.id, 'deleted');
        setAds((prev) => prev.filter((a) => a.id !== ad.id));
        toast('Advertisement deleted.');
        return;
      }
      await moderateAd({ id: ad.id, title: ad.title }, action, action === 'reject' ? rejectReason : undefined);
      setAds((prev) =>
        prev.map((a) =>
          a.id === ad.id
            ? action === 'approve'
              ? { ...a, status: 'approved' as const }
              : { ...a, status: 'rejected' as const }
            : a
        )
      );
      toast(action === 'approve' ? 'Advertisement approved.' : 'Advertisement rejected.');
    } catch (e: any) {
      toast(e.message === 'BACKEND_NOT_CONFIGURED'
        ? 'Backend not configured.'
        : "You don't have permission to perform this action.");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Advertisements</h1>
        <p className="text-xs text-slate-500 mt-1">Moderate listings before they go live. {ads.filter((a) => (a.status as string) === 'pending').length} awaiting review.</p>
      </div>

      <FilterTabs tabs={['All', ...FILTERS]} active={filter} onChange={setFilter} />

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 animate-pulse" aria-busy="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-12 h-9 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-grow space-y-2">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-3 w-1/5 rounded bg-slate-200" />
              </div>
              <div className="w-20 h-6 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
          <p className="text-sm font-semibold text-[#D32F2F]">{loadError}</p>
          <button onClick={() => void load()} className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold">Retry</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <p className="text-sm font-semibold text-slate-500">No advertisements in this state.</p>
        </div>
      ) : (
      <DataTable headers={['Advertisement', 'Seller', 'Category', 'Location', 'Status', 'Date', 'Actions']}>
        {visible.map((ad) => (
          <tr key={ad.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="pl-5 pr-3 py-3.5">
              <div className="flex items-center gap-3 min-w-0 max-w-[280px]">
                {ad.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.image} alt="" className="w-12 h-9 rounded-lg object-cover shrink-0 bg-slate-100" />
                ) : (
                  <span className="w-12 h-9 rounded-lg bg-slate-100 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block font-bold truncate">{ad.title}</span>
                  <span className="block text-[11px] text-slate-400">â‚¹{ad.price.toLocaleString('en-IN')}</span>
                </span>
              </div>
            </td>
            <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap">{ad.seller}</td>
            <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{ad.category}</td>
            <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{ad.location}</td>
            <td className="px-3 py-3.5">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeCls(ad.status)}`}>{ad.status}</span>
            </td>
            <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{ad.date}</td>
            <td className="pr-5 pl-3 py-3.5">
              <div className="flex items-center gap-1">
                <button onClick={() => setViewing(ad)} title="View" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-500 transition-colors"><Eye className="w-4 h-4" /></button>
                {(ad.status === 'pending' || (ad.status as string) === 'reported') && (
                  <>
                    <button onClick={() => void act(ad, 'approve')} title="Approve" className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 transition-colors"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setRejectTarget(ad)} title="Reject" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
                  </>
                )}
                <button onClick={() => toast('Feature promotions arrive with the payments phase.')} title="Feature" className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-700 text-slate-500 transition-colors"><Rocket className="w-4 h-4" /></button>
                <button onClick={() => setConfirmDelete(ad)} title="Delete" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-slate-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      )}

      {/* Moderation drawer/modal */}
      <Modal open={viewing !== null} onClose={() => setViewing(null)} title="Moderation Review" size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex gap-5">
              {viewing.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewing.image} alt="" className="w-40 h-30 aspect-[4/3] rounded-xl object-cover bg-slate-100 shrink-0" />
              ) : (
                <div className="w-40 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center text-xs text-slate-400">No image</div>
              )}
              <div className="min-w-0">
                <h4 className="font-black">{viewing.title}</h4>
                <p className="text-xl font-black text-[#E53935] mt-1">â‚¹{viewing.price.toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-400 mt-1">By {viewing.seller} Â· {viewing.location} Â· {viewing.date}</p>
                <span className={`inline-flex mt-2 px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeCls(viewing.status)}`}>{viewing.status}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">Description</p>
              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-4">{viewing.description}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              <button onClick={() => { const v = viewing; setViewing(null); if (v) void act(v, 'approve'); }} className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button onClick={() => { setRejectTarget(viewing); setViewing(null); }} className="py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                <X className="w-3.5 h-3.5" /> Reject
              </button>
              <button onClick={() => toast('Editing opens in the listing editor (next phase).')} className="py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject with mandatory reason */}
      <Modal open={rejectTarget !== null} onClose={() => setRejectTarget(null)} title="Reject Advertisement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">The seller will be notified with this reason and can edit &amp; resubmit.</p>
          <Select
            label="Rejection reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            options={REJECTION_REASONS.map((r) => ({ value: r, label: r }))}
          />
          <button
            onClick={() => { const t = rejectTarget; setRejectTarget(null); if (t) void act(t, 'reject'); }}
            className="w-full py-3 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-sm font-bold transition-colors"
          >
            Reject Advertisement
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && void act(confirmDelete, 'delete')}
        title="Delete advertisement?"
        message={`"${confirmDelete?.title}" will be removed from the marketplace. Audit records are preserved.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}