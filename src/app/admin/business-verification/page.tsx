'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { Check, X, Clock, ShieldCheck, Store } from 'lucide-react';

export default function BusinessVerificationPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending'|'verified'|'rejected'|'all'>('pending');

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const sb = getSupabaseBrowser()!;
    let q = sb.from('business_verification_requests').select('*, business_profiles!inner(business_name,business_slug), profiles!business_verification_requests_user_id_fkey(display_name,username)').order('submitted_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  };
  useEffect(()=>{ void load(); }, [filter]);

  const decide = async (id: string, status: 'verified'|'rejected', businessId: string, userId: string) => {
    const sb = getSupabaseBrowser()!;
    const { data: auth } = await sb.auth.getUser();
    await sb.from('business_verification_requests').update({ status, reviewed_at: new Date().toISOString(), reviewed_by: auth.user?.id, rejection_reason: status==='rejected' ? 'Does not meet verification criteria' : null }).eq('id', id);
    await sb.from('business_profiles').update({ verification_status: status }).eq('id', businessId);
    if (status==='verified') await sb.from('profiles').update({ business_verified: true }).eq('id', userId);
    await sb.from('admin_audit_logs').insert({ admin_id: auth.user!.id, action: status==='verified' ? 'BUSINESS_VERIFIED' : 'BUSINESS_REJECTED', entity_type: 'business', entity_id: businessId, metadata: { request_id: id } });
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Business Verification</h1>
          <p className="text-xs text-black mt-1">Review verification requests — approve, reject or request changes.</p>
        </div>
        <div className="flex gap-2">
          {(['pending','verified','rejected','all'] as const).map((f)=>(
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border ${filter===f?'bg-[#E53935] text-white border-[#E53935]':'bg-white border-slate-200 text-black'}`}>{f}</button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-sm text-black">Loading...</p> : items.length===0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-sm text-black">No {filter} requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((r)=>(
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col sm:flex-row gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center font-black shrink-0"><Store className="w-6 h-6" /></div>
              <div className="flex-grow min-w-0">
                <p className="font-bold flex items-center gap-2">{r.business_profiles.business_name}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status==='pending'?'bg-amber-50 text-amber-700':r.status==='verified'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}`}>{r.status}</span>
                </p>
                <p className="text-xs text-black">by {r.profiles?.display_name || r.profiles?.username} · {new Date(r.submitted_at).toLocaleDateString()}</p>
                <Link href={`/business/${r.business_profiles.business_slug}`} className="text-xs text-[#E53935] font-semibold hover:underline">View business →</Link>
              </div>
              {r.status==='pending' && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={()=>decide(r.id,'verified',r.business_id,r.user_id)} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"><Check className="w-4 h-4" /> Approve</button>
                  <button onClick={()=>decide(r.id,'rejected',r.business_id,r.user_id)} className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold flex items-center gap-1"><X className="w-4 h-4" /> Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
