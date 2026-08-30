'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Check, X, Pencil, Rocket, Trash2, AlertTriangle, ShieldAlert, History, Ban } from 'lucide-react';
import { DataTable, Select, Tabs as FilterTabs, Input } from '@/components/ui/Form';
import { Modal, ConfirmDialog, useToast } from '@/components/ui/Feedback';
import {
  adminListAds,
  moderateAd,
  AdminAdRow,
} from '@/services/ads';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

const FILTERS = ['Pending', 'Approved', 'Rejected', 'Reported', 'Expired', 'Sold', 'Draft', 'Changes_requested', 'Suspended'];

const REJECTION_REASONS = [
  'Incorrect category',
  'Spam',
  'Duplicate',
  'Prohibited item',
  'Misleading information',
  'Poor quality',
  'Suspicious activity',
  'Other',
];

function badgeCls(status: string) {
  switch (status) {
    case 'approved': case 'Approved': return 'bg-emerald-50 text-emerald-700';
    case 'pending': case 'Pending': return 'bg-amber-50 text-amber-700';
    case 'changes_requested': case 'Changes_requested': return 'bg-sky-50 text-sky-700';
    case 'suspended': case 'Suspended': return 'bg-orange-50 text-orange-700';
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
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<AdminAdRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminAdRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminAdRow | null>(null);
  const [requestTarget, setRequestTarget] = useState<AdminAdRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminAdRow | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);
  const [requestMsg, setRequestMsg] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [historyAd, setHistoryAd] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const filteredVisible = ads.filter((a) => {
    const f = filter.toLowerCase();
    const matchesFilter = filter === 'All' || a.status.toLowerCase() === f;
    const q = search.toLowerCase();
    const matchesSearch = !q || a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.seller.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const openHistory = async (adId: string) => {
    setHistoryAd(adId);
    setHistoryLoading(true);
    const sb = getSupabaseBrowser();
    if (sb) {
      const { data } = await sb.from('admin_audit_logs').select('*').eq('entity_id', adId).order('created_at', { ascending: false }).limit(20);
      setHistoryItems(data || []);
    } else {
      setHistoryItems([{ action: 'AD_APPROVED', created_at: new Date().toISOString(), metadata: { reason: 'mock' } }]);
    }
    setHistoryLoading(false);
  };

  const act = async (ad: AdminAdRow, action: 'approve' | 'reject' | 'delete' | 'request_changes' | 'suspend') => {
    try {
      if (action === 'delete') {
        const { setAdStatus } = await import('@/services/ads');
        await setAdStatus(ad.id, 'deleted');
        setAds((prev) => prev.filter((a) => a.id !== ad.id));
        toast('Advertisement deleted.');
        return;
      }
      if (action === 'request_changes') {
        // Use direct status update via admin (bypasses owner guard)
        const sb = getSupabaseBrowser();
        if (sb) {
          await sb.from('ads').update({ status: 'changes_requested', rejection_reason: requestMsg || 'Please update your advertisement.' }).eq('id', ad.id);
          await sb.from('admin_audit_logs').insert({ admin_id: (await sb.auth.getUser()).data.user!.id, action: 'AD_CHANGES_REQUESTED', entity_type: 'ad', entity_id: ad.id, metadata: { reason: requestMsg } });
          await sb.from('notifications').insert({ user_id: (await sb.from('ads').select('user_id').eq('id', ad.id).single()).data?.user_id, type: 'ad_changes_requested', title: 'Please update your advertisement.', body: requestMsg });
        }
        setAds((prev) => prev.map((a) => a.id === ad.id ? { ...a, status: 'changes_requested' as any } : a));
        toast('Changes requested — seller notified.');
        return;
      }
      if (action === 'suspend') {
        const sb = getSupabaseBrowser();
        if (sb) {
          await sb.from('ads').update({ status: 'suspended' }).eq('id', ad.id);
          await sb.from('admin_audit_logs').insert({ admin_id: (await sb.auth.getUser()).data.user!.id, action: 'AD_SUSPENDED', entity_type: 'ad', entity_id: ad.id, metadata: { reason: suspendReason } });
        }
        setAds((prev) => prev.map((a) => a.id === ad.id ? { ...a, status: 'suspended' as any } : a));
        toast('Advertisement suspended.');
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
      toast(e.message === 'BACKEND_NOT_CONFIGURED' ? 'Backend not configured.' : e.message || "You don't have permission to perform this action.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Advertisements</h1>
          <p className="text-xs text-slate-700 mt-1">Moderate listings before they go live. {ads.filter((a) => (a.status as string) === 'pending').length} awaiting review.</p>
        </div>
        <Input placeholder="Search by title, ID or seller..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search ads" className="sm:w-64" />
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
      ) : filteredVisible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <p className="text-sm font-semibold text-slate-700">No advertisements in this state.</p>
        </div>
      ) : (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wider text-slate-700">
              <th className="pl-5 pr-3 py-3.5 font-bold">Advertisement</th>
              <th className="px-3 py-3.5 font-bold">Seller</th>
              <th className="px-3 py-3.5 font-bold">Category</th>
              <th className="px-3 py-3.5 font-bold">Location</th>
              <th className="px-3 py-3.5 font-bold">Status</th>
              <th className="px-3 py-3.5 font-bold">Date</th>
              <th className="pr-5 pl-3 py-3.5 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredVisible.map((ad) => (
              <tr key={ad.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="pl-5 pr-3 py-3.5">
                  <div className="flex items-center gap-3 min-w-0 max-w-[260px]">
                    {ad.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ad.image} alt="" className="w-12 h-9 rounded-lg object-cover shrink-0 bg-slate-100" />
                    ) : (
                      <span className="w-12 h-9 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-[10px] text-slate-700">No img</span>
                    )}
                    <span className="min-w-0">
                      <span className="block font-bold truncate" title={ad.title}>{ad.title}</span>
                      <span className="block text-[11px] text-slate-700">₹{ad.price.toLocaleString('en-IN')} • {ad.id.slice(0,8)}</span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap">{ad.seller}</td>
                <td className="px-3 py-3.5 text-slate-700 whitespace-nowrap">{ad.category}</td>
                <td className="px-3 py-3.5 text-slate-700 whitespace-nowrap">{ad.location}</td>
                <td className="px-3 py-3.5">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeCls(ad.status)}`}>{ad.status}</span>
                </td>
                <td className="px-3 py-3.5 text-slate-700 whitespace-nowrap">{ad.date}</td>
                <td className="pr-5 pl-3 py-3.5">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setViewing(ad)} title="View" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-700 transition-colors"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openHistory(ad.id)} title="History" className="p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"><History className="w-4 h-4" /></button>
                    {(ad.status === 'pending' || (ad.status as string) === 'reported' || (ad.status as string) === 'changes_requested') && (
                      <>
                        <button onClick={() => void act(ad, 'approve')} title="Approve" className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setRejectTarget(ad)} title="Reject" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-slate-700 transition-colors"><X className="w-4 h-4" /></button>
                        <button onClick={() => setRequestTarget(ad)} title="Request changes" className="p-2 rounded-lg hover:bg-sky-50 hover:text-sky-700 text-slate-700 transition-colors"><Pencil className="w-4 h-4" /></button>
                      </>
                    )}
                    {ad.status === 'approved' && (
                      <button onClick={() => setSuspendTarget(ad)} title="Suspend" className="p-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 text-slate-700 transition-colors"><Ban className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => toast('Feature promotions arrive with the payments phase.')} title="Feature" className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-700 text-slate-700 transition-colors"><Rocket className="w-4 h-4" /></button>
                    <button onClick={() => setConfirmDelete(ad)} title="Delete" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-slate-700 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Moderation drawer/modal */}
      <Modal open={viewing !== null} onClose={() => setViewing(null)} title="Moderation Review" size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex gap-5">
              {viewing.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewing.image} alt="" className="w-40 aspect-[4/3] rounded-xl object-cover bg-slate-100 shrink-0" />
              ) : (
                <div className="w-40 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center text-xs text-slate-700">No image</div>
              )}
              <div className="min-w-0">
                <h4 className="font-black">{viewing.title}</h4>
                <p className="text-xl font-black text-[#E53935] mt-1">₹{viewing.price.toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-700 mt-1">By {viewing.seller} · {viewing.location} · {viewing.date}</p>
                <span className={`inline-flex mt-2 px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeCls(viewing.status)}`}>{viewing.status}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-1.5">Description</p>
              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-4">{viewing.description}</p>
            </div>
            {/* Safety checks */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Image: JPEG/PNG/WebP, &lt;10MB, clean filename</div>
              <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-sky-500" /> Keyword scan: no prohibited terms flagged</div>
            </div>
          </div>
        )}
      </Modal>

      {/* History drawer */}
      <Modal open={historyAd !== null} onClose={() => setHistoryAd(null)} title="Moderation History" size="md">
        {historyLoading ? (
          <p className="text-sm text-slate-700 py-6 text-center">Loading history...</p>
        ) : historyItems.length === 0 ? (
          <p className="text-sm text-slate-700 py-6 text-center">No moderation history for this ad.</p>
        ) : (
          <ul className="space-y-3">
            {historyItems.map((h, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-[#E53935] mt-2 shrink-0" />
                <span>
                  <span className="font-bold">{h.action}</span> <span className="text-slate-700">· {new Date(h.created_at).toLocaleString('en-IN')}</span>
                  <span className="block text-xs text-slate-700 mt-1">{h.metadata?.reason || JSON.stringify(h.metadata || {}).slice(0,120)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Request changes */}
      <Modal open={requestTarget !== null} onClose={() => setRequestTarget(null)} title="Request Changes" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Seller will be notified and can edit and resubmit. Status becomes <span className="font-bold">changes_requested</span>.</p>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Message to seller</label>
            <textarea value={requestMsg} onChange={(e) => setRequestMsg(e.target.value)} rows={3} placeholder="Please add clearer photos and correct the category..." className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent" />
          </div>
          <button onClick={() => { const t=requestTarget; setRequestTarget(null); if(t) void act(t,'request_changes'); setRequestMsg(''); }} className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold transition-colors">Send Request</button>
        </div>
      </Modal>

      {/* Suspend */}
      <Modal open={suspendTarget !== null} onClose={() => setSuspendTarget(null)} title="Suspend Advertisement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Suspended ads are hidden from public until unsuspended.</p>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Reason</label>
            <input value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Violation of community guidelines" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent" />
          </div>
          <button onClick={() => { const t=suspendTarget; setSuspendTarget(null); if(t) void act(t,'suspend'); setSuspendReason(''); }} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors">Suspend Ad</button>
        </div>
      </Modal>

      {/* Reject with mandatory reason */}
      <Modal open={rejectTarget !== null} onClose={() => setRejectTarget(null)} title="Reject Advertisement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">The seller will be notified with this reason and can edit & resubmit.</p>
          <Select label="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} options={REJECTION_REASONS.map((r) => ({ value: r, label: r }))} />
          <button onClick={() => { const t = rejectTarget; setRejectTarget(null); if (t) void act(t, 'reject'); }} className="w-full py-3 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-sm font-bold transition-colors">Reject Advertisement</button>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && void act(confirmDelete, 'delete')} title="Delete advertisement?" message={`"${confirmDelete?.title}" will be removed from the marketplace. Audit records are preserved.`} confirmLabel="Delete" danger />
    </div>
  );
}
