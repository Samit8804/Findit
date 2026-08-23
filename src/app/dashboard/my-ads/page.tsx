'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Eye,
  Pencil,
  Rocket,
  RefreshCcw,
  Tag,
  Trash2,
  PlusCircle,
  PackageOpen,
} from 'lucide-react';
import { getCurrentSession } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  getMyAds,
  setAdStatus,
  renewAd,
  MyAdRow,
  DbAdStatus,
} from '@/services/ads';
import { ExpiredListingState, RejectedListingState } from '@/components/states/AdStates';

type DisplayStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Expired' | 'Sold';

function displayStatus(s: DbAdStatus): DisplayStatus {
  switch (s) {
    case 'draft': return 'Draft';
    case 'pending': return 'Pending';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'expired': return 'Expired';
    case 'sold': return 'Sold';
    default: return 'Pending';
  }
}

function badgeCls(s: DisplayStatus): string {
  switch (s) {
    case 'Approved': return 'bg-emerald-50 text-emerald-700';
    case 'Pending': return 'bg-amber-50 text-amber-700';
    case 'Rejected': return 'bg-red-50 text-[#D32F2F]';
    case 'Expired': return 'bg-slate-100 text-slate-600';
    case 'Sold': return 'bg-sky-50 text-sky-700';
    default: return 'bg-slate-100 text-slate-500';
  }
}

const FILTERS: ('All' | DisplayStatus)[] = ['All', 'Draft', 'Pending', 'Approved', 'Rejected', 'Expired', 'Sold'];

interface RowAd extends MyAdRow {
  display: DisplayStatus;
}

function MyAdsContent() {
  const searchParams = useSearchParams();
  const user = getCurrentSession().user;

  const [rows, setRows] = useState<RowAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<'All' | DisplayStatus>('All');
  const [stateModal, setStateModal] = useState<'expired' | 'rejected' | null>(null);
  const [toast, setToast] = useState('');

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const ads = await getMyAds();
      setRows(ads.map((a) => ({ ...a, display: displayStatus(a.status) })));
    } catch (e: any) {
      setLoadError('Unable to load advertisements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = filter === 'All' ? rows : rows.filter((r) => r.display === filter);

  /* ---------------- actions ---------------- */

  const handleDelete = async (ad: RowAd) => {
    if (!window.confirm(`Delete "${ad.title}"? This cannot be undone.`)) return;
    if (!isSupabaseConfigured) {
      setRows((prev) => prev.filter((r) => r.id !== ad.id));
      flash('Advertisement deleted.');
      return;
    }
    try {
      await setAdStatus(ad.id, 'deleted');
      await load();
      flash('Advertisement deleted.');
    } catch {
      flash("You don't have permission to perform this action.");
    }
  };

  const handleMarkSold = async (ad: RowAd) => {
    if (!isSupabaseConfigured) {
      setRows((prev) => prev.map((r) => (r.id === ad.id ? { ...r, display: 'Sold' } : r)));
      flash('This advertisement has been marked as sold.');
      return;
    }
    try {
      await setAdStatus(ad.id, 'sold');
      await load();
      flash('This advertisement has been marked as sold.');
    } catch {
      flash("You don't have permission to perform this action.");
    }
  };

  const handleRenew = async (ad: RowAd) => {
    if (!isSupabaseConfigured) {
      setRows((prev) => prev.map((r) => (r.id === ad.id ? { ...r, display: 'Pending' } : r)));
      flash('Listing renewed — awaiting review.');
      return;
    }
    try {
      await renewAd(ad.id);
      await load();
      flash('Listing renewed — awaiting review.');
    } catch {
      flash("You don't have permission to perform this action.");
    }
  };

  /* ---------------- action buttons per status ---------------- */

  const actionsCell = (ad: RowAd) => {
    const canResubmit = ad.display === 'Rejected' || ad.display === 'Draft';
    const canSell = ad.display === 'Approved';
    const canRenew = ad.display === 'Expired' || ad.display === 'Sold';
    return (
      <div className="flex items-center gap-1">
        {(ad.display === 'Expired' || ad.display === 'Rejected') ? (
          <>
            <button onClick={() => setStateModal(ad.display === 'Expired' ? 'expired' : 'rejected')} title="View"
              className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-500 transition-colors">
              <Eye className="w-4 h-4" />
            </button>
            <Link href={`/post-ad?edit=${ad.id}`} title="Fix & Resubmit"
              className="p-2 rounded-lg bg-red-50 text-[#E53935] hover:bg-[#E53935] hover:text-white transition-colors">
              <Pencil className="w-4 h-4" />
            </Link>
            <button onClick={() => handleRenew(ad)} title="Renew"
              className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 transition-colors">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <Link href={`/ad/${ad.slug}`} title="View" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-500 transition-colors">
              <Eye className="w-4 h-4" />
            </Link>
            {canResubmit && (
              <Link href={`/post-ad?edit=${ad.id}`} title={ad.display === 'Draft' ? 'Continue Editing' : 'Edit'}
                className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-500 transition-colors">
                <Pencil className="w-4 h-4" />
              </Link>
            )}
            <Link href={`/promote?id=${ad.id}`} title="Boost / Promote"
              className={`p-2 rounded-lg transition-colors ${canSell ? 'bg-red-50 text-[#E53935] hover:bg-[#E53935] hover:text-white' : 'text-slate-400 hover:bg-red-50 hover:text-[#E53935]'}`}>
              <Rocket className="w-4 h-4" />
            </Link>
            <button onClick={() => handleRenew(ad)} title="Renew" disabled={!canRenew}
              className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 disabled:opacity-40 transition-colors">
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button onClick={() => handleMarkSold(ad)} title="Mark Sold" disabled={!canSell}
              className="p-2 rounded-lg hover:bg-sky-50 hover:text-sky-700 text-slate-500 disabled:opacity-40 transition-colors">
              <Tag className="w-4 h-4" />
            </button>
          </>
        )}
        <button onClick={() => handleDelete(ad)} title="Delete"
          className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-slate-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const bannerKey = searchParams.get('status');

  return (
    <div>
      {/* Success banners */}
      {bannerKey === 'success' && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2" role="status">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <p className="text-sm font-semibold text-emerald-800">Your advertisement has been published successfully!</p>
        </div>
      )}
      {bannerKey === 'submitted' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100" role="status">
          <p className="text-sm font-semibold text-amber-800">Your advertisement has been submitted for review.</p>
          <p className="text-xs text-amber-700 mt-0.5">You will be notified once it is approved.</p>
        </div>
      )}
      {bannerKey === 'draft' && (
        <div className="mb-6 p-4 rounded-xl bg-sky-50 border border-sky-100" role="status">
          <p className="text-sm font-semibold text-sky-800">Advertisement saved as draft.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">My Ads</h1>
          <p className="text-xs text-slate-500 mt-1">{loading ? 'Loading advertisements...' : `${rows.length} total listings`}</p>
        </div>
        <Link
          href="/post-ad"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold shadow-md shadow-red-200 transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> Post New Ad
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              filter === f
                ? 'bg-[#E53935] text-white border-[#E53935]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f}
            <span className="ml-1 opacity-70">
              ({f === 'All' ? rows.length : rows.filter((r) => r.display === f).length})
            </span>
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 animate-pulse" aria-busy="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-14 h-11 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-grow space-y-2">
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="h-3 w-1/4 rounded bg-slate-200" />
              </div>
              <div className="w-20 h-6 rounded-full bg-slate-200 hidden sm:block" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
          <p className="text-sm font-semibold text-[#D32F2F]">{loadError}</p>
          <button onClick={() => void load()} className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold">Retry</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-[#E53935] mb-4">
            <PackageOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-1">{filter === 'All' ? 'No advertisements found.' : `No ${filter.toLowerCase()} ads`}</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">Post an ad and manage everything from this dashboard.</p>
          <Link href="/post-ad" className="px-6 py-3 bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold rounded-xl transition-colors">Post an Ad</Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="pl-5 pr-3 py-3.5 font-bold">Advertisement</th>
                  <th className="px-3 py-3.5 font-bold">Price</th>
                  <th className="px-3 py-3.5 font-bold">Status</th>
                  <th className="px-3 py-3.5 font-bold">Views</th>
                  <th className="px-3 py-3.5 font-bold">Created</th>
                  <th className="pr-5 pl-3 py-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((ad) => (
                  <tr key={ad.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="pl-5 pr-3 py-3.5">
                      <div className="flex items-center gap-3 min-w-0 max-w-[320px]">
                        {ad.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ad.image} alt="" className="w-14 h-11 rounded-lg object-cover shrink-0 bg-slate-100" />
                        ) : (
                          <span className="w-14 h-11 rounded-lg bg-slate-100 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-bold truncate">{ad.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">ID: {ad.id.slice(0, 8)}…</p>
                          {ad.rejectionReason && ad.display === 'Rejected' && (
                            <p className="text-[10px] text-[#D32F2F] truncate mt-0.5">Reason: {ad.rejectionReason}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 font-bold whitespace-nowrap">₹{ad.price.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeCls(ad.display)}`}>{ad.display}</span>
                    </td>
                    <td className="px-3 py-3.5 text-slate-600">{ad.views.toLocaleString()}</td>
                    <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{ad.createdAt}</td>
                    <td className="pr-5 pl-3 py-3.5">{actionsCell(ad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {visible.map((ad) => (
              <div key={ad.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex gap-3 p-4">
                  {ad.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.image} alt="" className="w-20 h-16 rounded-xl object-cover shrink-0 bg-slate-100" />
                  ) : (
                    <span className="w-20 h-16 rounded-xl bg-slate-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold line-clamp-2 leading-snug">{ad.title}</p>
                    <p className="text-base font-black mt-1">₹{ad.price.toLocaleString('en-IN')}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeCls(ad.display)}`}>{ad.display}</span>
                      <span className="text-[10px] text-slate-400">{ad.views.toLocaleString()} views</span>
                    </div>
                  </div>
                </div>
                {ad.rejectionReason && ad.display === 'Rejected' && (
                  <p className="mx-4 mb-3 text-[11px] bg-red-50 text-[#D32F2F] rounded-lg px-3 py-2">Reason: {ad.rejectionReason}</p>
                )}
                <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Created {ad.createdAt}</span>
                </div>
                <div className="border-t border-slate-100 p-3 flex justify-center flex-wrap gap-1">{actionsCell(ad)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 bg-[#0F172A] text-white text-sm font-semibold rounded-xl shadow-2xl text-center" role="status">
          {toast}
        </div>
      )}

      <ExpiredListingState open={stateModal === 'expired'} onClose={() => setStateModal(null)} />
      <RejectedListingState open={stateModal === 'rejected'} onClose={() => setStateModal(null)} />
    </div>
  );
}

export default function MyAdsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-400">Loading...</div>}>
      <MyAdsContent />
    </Suspense>
  );
}