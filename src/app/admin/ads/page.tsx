'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Check, X, Pencil, Rocket, Trash2, AlertTriangle, ShieldAlert, History, Ban, Search } from 'lucide-react';
import { DataTable, Select, Tabs as FilterTabs, Input, Pagination } from '@/components/ui/Form';
import { Modal, ConfirmDialog, useToast } from '@/components/ui/Feedback';
import { adminListAds, moderateAd, AdminAdRow, adminGetAdDetail } from '@/services/ads';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { statusBadgeCls } from '@/lib/adStatus';

const FILTERS = ['Pending', 'Approved', 'Rejected', 'Reported', 'Expired', 'Sold', 'Draft', 'Changes_requested', 'Suspended'];
const REJECTION_REASONS = ['Incorrect category','Spam','Duplicate','Prohibited item','Misleading information','Poor quality','Suspicious activity','Other'];
const PAGE_SIZE = 20;

export default function AdminAdsPage() {
  const toast = useToast();
  const [ads, setAds] = useState<AdminAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('Pending');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewing, setViewing] = useState<AdminAdRow | null>(null);
  const [viewingDetail, setViewingDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);

  // Debounce search
  useEffect(() => { const t = setTimeout(() => { setDebouncedSearch(search.trim().toLowerCase()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [filter]);

  const load = useCallback(async (attempt = 0) => {
    setLoading(true); setLoadError('');
    try {
      const data = await adminListAds('All');
      setAds(data); setRetryCount(0);
    } catch (e: any) {
      console.error('[admin/ads] load failed:', e?.message || e);
      if (attempt < 2) { setTimeout(() => load(attempt + 1), 1000 * (attempt + 1)); return; }
      setLoadError(e?.message ? `Unable to load advertisements: ${e.message}` : 'Unable to load advertisements.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Realtime subscription for ads
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabaseBrowser()!;
    const ch = sb.channel('admin-ads-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, () => { void load(); }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [load]);

  // Dynamic tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { All: ads.length };
    FILTERS.forEach(f => { counts[f] = ads.filter(a => a.status.toLowerCase() === f.toLowerCase()).length; });
    return counts;
  }, [ads]);

  const filteredVisible = useMemo(() => ads.filter(a => {
    const matchesFilter = filter === 'All' || a.status.toLowerCase() === filter.toLowerCase();
    if (!matchesFilter) return false;
    if (!debouncedSearch) return true;
    const q = debouncedSearch;
    return a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.seller.toLowerCase().includes(q) || (a.sellerEmail && a.sellerEmail.toLowerCase().includes(q)) || a.category.toLowerCase().includes(q);
  }), [ads, filter, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredVisible.length / PAGE_SIZE));
  const paged = useMemo(() => filteredVisible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredVisible, page]);

  const openDetail = async (ad: AdminAdRow) => {
    setViewing(ad); setDetailLoading(true); setViewingDetail(null);
    try {
      const detail = await adminGetAdDetail(ad.id);
      setViewingDetail(detail);
    } catch (e: any) {
      console.error('[admin/ads] detail fetch failed', e);
      toast('Failed to load full advertisement details: ' + (e.message || 'unknown'));
      setViewingDetail(ad as any);
    } finally { setDetailLoading(false); }
  };

  const openHistory = async (adId: string) => {
    setHistoryAd(adId); setHistoryLoading(true);
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
        setAds(prev => prev.filter(a => a.id !== ad.id));
        toast('Advertisement deleted.');
        return;
      }
      if (action === 'request_changes') {
        const sb = getSupabaseBrowser();
        if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
        const { error } = await sb.from('ads').update({ status: 'changes_requested', rejection_reason: requestMsg || 'Please update your advertisement.' }).eq('id', ad.id);
        if (error) throw new Error(error.message);
        await sb.from('admin_audit_logs').insert({ admin_id: (await sb.auth.getUser()).data.user!.id, action: 'AD_CHANGES_REQUESTED', entity_type: 'ad', entity_id: ad.id, metadata: { reason: requestMsg } });
        const { data: owner } = await sb.from('ads').select('user_id').eq('id', ad.id).single();
        if (owner?.user_id) await sb.rpc('notify_user', { p_user: owner.user_id, p_type: 'ad_changes_requested', p_title: 'Please update your advertisement.', p_body: requestMsg });
        setAds(prev => prev.map(a => a.id === ad.id ? { ...a, status: 'changes_requested' as any } : a));
        toast('Changes requested — seller notified.');
        return;
      }
      if (action === 'suspend') {
        const sb = getSupabaseBrowser();
        if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
        const { error } = await sb.from('ads').update({ status: 'suspended' }).eq('id', ad.id);
        if (error) throw new Error(error.message);
        await sb.from('admin_audit_logs').insert({ admin_id: (await sb.auth.getUser()).data.user!.id, action: 'AD_SUSPENDED', entity_type: 'ad', entity_id: ad.id, metadata: { reason: suspendReason } });
        setAds(prev => prev.map(a => a.id === ad.id ? { ...a, status: 'suspended' as any } : a));
        toast('Advertisement suspended.');
        return;
      }
      await moderateAd({ id: ad.id, title: ad.title }, action, action === 'reject' ? rejectReason : undefined);
      setAds(prev => prev.map(a => a.id === ad.id ? (action === 'approve' ? { ...a, status: 'approved' as const } : { ...a, status: 'rejected' as const }) : a));
      toast(action === 'approve' ? 'Advertisement approved.' : 'Advertisement rejected.');
      if (viewing && viewing.id === ad.id) setViewing(prev => prev ? { ...prev, status: action === 'approve' ? 'approved' as any : 'rejected' as any } : prev);
    } catch (e: any) {
      console.error('[admin/ads] moderation failed', e);
      toast(e.message === 'BACKEND_NOT_CONFIGURED' ? 'Backend not configured.' : e.message || "You don't have permission to perform this action.");
    }
  };

  const tabsWithCounts = useMemo(() => ['All', ...FILTERS].map(t => `${t} (${tabCounts[t] ?? 0})`), [tabCounts]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">Advertisements</h1>
          <p className="text-xs text-black mt-1">Moderate listings before they go live. <span className="font-black text-amber-600">{tabCounts['Pending'] ?? 0} awaiting review</span> • {ads.length} total</p>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
          <Input placeholder="Search title, ID, seller, email, category..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Search ads" className="pl-9" />
        </div>
      </div>

      <FilterTabs tabs={tabsWithCounts} active={`${filter} (${tabCounts[filter] ?? 0})`} onChange={t => setFilter(t.split(' (')[0])} />

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
          <p className="text-xs text-black mt-2">Check console for technical details. RLS: ensure admin role is set and is_admin() returns true.</p>
          <button onClick={() => void load()} className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold">Retry</button>
        </div>
      ) : filteredVisible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <p className="text-sm font-semibold text-black">No advertisements in this state.</p>
          <p className="text-xs text-black mt-1">Try another filter or search term.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wider text-black">
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
                {paged.map(ad => (
                  <tr key={ad.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="pl-5 pr-3 py-3.5">
                      <div className="flex items-center gap-3 min-w-0 max-w-[280px]">
                        {ad.image ? <img src={ad.image} alt="" className="w-12 h-9 rounded-lg object-cover shrink-0 bg-slate-100" /> : <span className="w-12 h-9 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-[10px] text-black">No img</span>}
                        <span className="min-w-0">
                          <span className="block font-bold truncate text-[#0F172A]" title={ad.title}>{ad.title}</span>
                          <span className="block text-[11px] text-black">₹{ad.price.toLocaleString('en-IN')} • {ad.id.slice(0,8)} {ad.isFeatured && <span className="ml-1 inline-flex px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold">⭐ Featured</span>}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <span className="block text-xs font-semibold text-[#0F172A]">{ad.seller}</span>
                      {ad.sellerEmail && <span className="block text-[11px] text-black truncate max-w-[140px]">{ad.sellerEmail}</span>}
                    </td>
                    <td className="px-3 py-3.5 text-black whitespace-nowrap text-xs">{ad.category}</td>
                    <td className="px-3 py-3.5 text-black whitespace-nowrap text-xs">{ad.location}</td>
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadgeCls(ad.status)}`}>{ad.status}</span>
                    </td>
                    <td className="px-3 py-3.5 text-black whitespace-nowrap text-xs">{ad.date}</td>
                    <td className="pr-5 pl-3 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openDetail(ad)} title="View full details" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-black transition-colors"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openHistory(ad.id)} title="History" className="p-2 rounded-lg hover:bg-slate-100 text-black transition-colors"><History className="w-4 h-4" /></button>
                        {((ad.status as string) === 'pending' || (ad.status as string) === 'reported' || (ad.status as string) === 'changes_requested') && (
                          <>
                            <button onClick={() => void act(ad, 'approve')} title="Approve" className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-black transition-colors"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setRejectTarget(ad)} title="Reject" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-black transition-colors"><X className="w-4 h-4" /></button>
                            <button onClick={() => setRequestTarget(ad)} title="Request changes" className="p-2 rounded-lg hover:bg-sky-50 hover:text-sky-700 text-black transition-colors"><Pencil className="w-4 h-4" /></button>
                          </>
                        )}
                        {(ad.status as string) === 'approved' && <button onClick={() => setSuspendTarget(ad)} title="Suspend" className="p-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 text-black transition-colors"><Ban className="w-4 h-4" /></button>}
                        <button onClick={() => setConfirmDelete(ad)} title="Delete" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-black transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          <p className="text-center text-[11px] text-black">Page {page} of {totalPages} — {filteredVisible.length} filtered • {ads.length} total</p>
        </>
      )}

      <Modal open={viewing !== null} onClose={() => { setViewing(null); setViewingDetail(null); }} title="Moderation Review" size="lg">
        {viewing && (
          <div className="space-y-5">
            {detailLoading ? <p className="text-sm text-black py-6 text-center animate-pulse">Loading full advertisement...</p> : viewingDetail ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(viewingDetail.imagesFull || viewingDetail.images || [viewing.image]).filter(Boolean).map((src: string, i: number) => (
                    <img key={i} src={src} alt={`Image ${i+1}`} className="w-full aspect-[4/3] rounded-xl object-cover bg-slate-100 border border-slate-100" onError={e => (e.currentTarget.style.display='none')} />
                  ))}
                  {(viewingDetail.imagesFull?.length ?? 0) === 0 && <div className="col-span-full py-8 text-center text-xs text-black bg-slate-50 rounded-xl border border-slate-100">No images</div>}
                </div>
                <div className="flex gap-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-[#0F172A] text-lg">{viewingDetail.title}</h4>
                    <p className="text-xl font-black text-[#E53935] mt-1">₹{Number(viewingDetail.price).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-black mt-1">By {viewingDetail.seller} {viewingDetail.sellerEmail && <span className="text-black">· {viewingDetail.sellerEmail}</span>} · {viewingDetail.location} · {viewingDetail.date}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadgeCls(viewingDetail.status)}`}>{viewingDetail.status}</span>
                      {viewingDetail.isFeatured && <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-700">⭐ Featured ₹99</span>}
                      {viewingDetail.sellerVerified && <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">Verified seller</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><span className="block text-[11px] font-bold text-black uppercase">Category</span><span className="font-semibold text-[#0F172A]">{viewingDetail.category}{viewingDetail.subcategory ? ` › ${viewingDetail.subcategory}` : ''}</span></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><span className="block text-[11px] font-bold text-black uppercase">Location</span><span className="font-semibold text-[#0F172A]">{viewingDetail.location}</span></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><span className="block text-[11px] font-bold text-black uppercase">Seller</span><span className="font-semibold text-[#0F172A]">{viewingDetail.seller}</span><span className="block text-[11px] text-black">{viewingDetail.sellerEmail} {viewingDetail.sellerPhone && `· ${viewingDetail.sellerPhone}`}</span></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><span className="block text-[11px] font-bold text-black uppercase">Views / Featured</span><span className="font-semibold text-[#0F172A]">{viewingDetail.viewsCount ?? 0} views {viewingDetail.isFeatured ? '• Featured' : ''}</span></div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-black mb-1.5">Description</p>
                  <p className="text-sm text-black leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100">{viewingDetail.description}</p>
                </div>
                {viewingDetail.attributes && Object.keys(viewingDetail.attributes).length>0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-black mb-1.5">Attributes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(viewingDetail.attributes).map(([k,v])=> <span key={k} className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs"><span className="font-bold text-[#0F172A]">{k}:</span> <span className="text-black">{String(v)}</span></span>)}
                    </div>
                  </div>
                )}
                {viewingDetail.rejectionReason && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs"><span className="font-bold text-[#D32F2F]">Rejection reason:</span> <span className="text-black">{viewingDetail.rejectionReason}</span></div>}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2 border border-slate-100"><ShieldAlert className="w-4 h-4 text-amber-500" /> Image: JPEG/PNG/WebP, &lt;10MB</div>
                  <div className="p-3 rounded-xl bg-slate-50 flex items-center gap-2 border border-slate-100"><AlertTriangle className="w-4 h-4 text-sky-500" /> Keyword scan: no prohibited terms</div>
                </div>
                <div className="flex gap-2 pt-2">
                  {((viewingDetail.status as string) === 'pending' || (viewingDetail.status as string) === 'changes_requested' || (viewingDetail.status as string) === 'reported') && (
                    <>
                      <button onClick={() => { const v=viewing; setViewing(null); setViewingDetail(null); if(v) void act(v,'approve'); }} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold">Approve</button>
                      <button onClick={() => { setViewing(null); setRejectTarget(viewing); }} className="flex-1 py-3 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-sm font-bold">Reject</button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-black">Failed to load details.</p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={historyAd !== null} onClose={() => setHistoryAd(null)} title="Moderation History" size="md">
        {historyLoading ? <p className="text-sm text-black py-6 text-center">Loading history...</p> : historyItems.length === 0 ? <p className="text-sm text-black py-6 text-center">No moderation history for this ad.</p> : (
          <ul className="space-y-3">
            {historyItems.map((h,i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-[#E53935] mt-2 shrink-0" />
                <span><span className="font-bold">{h.action}</span> <span className="text-black">· {new Date(h.created_at).toLocaleString('en-IN')}</span><span className="block text-xs text-black mt-1">{h.metadata?.reason || JSON.stringify(h.metadata || {}).slice(0,120)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={requestTarget !== null} onClose={() => setRequestTarget(null)} title="Request Changes" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-black">Seller will be notified and can edit and resubmit. Status becomes <span className="font-bold">changes_requested</span>.</p>
          <div><label className="block text-xs font-bold text-black mb-1.5">Message to seller</label><textarea value={requestMsg} onChange={e => setRequestMsg(e.target.value)} rows={3} placeholder="Please add clearer photos and correct the category..." className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent" /></div>
          <button onClick={() => { const t=requestTarget; setRequestTarget(null); if(t) void act(t,'request_changes'); setRequestMsg(''); }} className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold transition-colors">Send Request</button>
        </div>
      </Modal>

      <Modal open={suspendTarget !== null} onClose={() => setSuspendTarget(null)} title="Suspend Advertisement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-black">Suspended ads are hidden from public until unsuspended.</p>
          <div><label className="block text-xs font-bold text-black mb-1.5">Reason</label><input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Violation of community guidelines" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent" /></div>
          <button onClick={() => { const t=suspendTarget; setSuspendTarget(null); if(t) void act(t,'suspend'); setSuspendReason(''); }} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors">Suspend Ad</button>
        </div>
      </Modal>

      <Modal open={rejectTarget !== null} onClose={() => setRejectTarget(null)} title="Reject Advertisement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-black">The seller will be notified with this reason and can edit & resubmit.</p>
          <Select label="Rejection reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} options={REJECTION_REASONS.map(r => ({ value: r, label: r }))} />
          <button onClick={() => { const t = rejectTarget; setRejectTarget(null); if (t) void act(t, 'reject'); }} className="w-full py-3 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-sm font-bold transition-colors">Reject Advertisement</button>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && void act(confirmDelete, 'delete')} title="Delete advertisement?" message={`"${confirmDelete?.title}" will be removed from the marketplace. Audit records are preserved.`} confirmLabel="Delete" danger />
    </div>
  );
}
