'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { compressImage } from '@/lib/images';
import { Camera, Check, ShieldCheck, Store, Award, Clock } from 'lucide-react';

const inputCls = (err?: string) =>
  `w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${err?'border-red-300 bg-red-50':'border-slate-200'}`;

export default function BusinessDashboardPage() {
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [business, setBusiness] = useState<any>(null);
  const [form, setForm] = useState({
    business_name: '', business_category: '', business_description: '', business_phone: '', business_email: '', website: '', address: '', city: '', state: '', postal_code: '', established_year: '',
  });
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setHasBusiness(false); return; }
    const sb = getSupabaseBrowser()!;
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setHasBusiness(false); return; }
      const { data: b } = await sb.from('business_profiles').select('*').eq('user_id', data.user.id).maybeSingle();
      if (b) { setHasBusiness(true); setBusiness(b); setLogo(b.business_logo); setForm({
        business_name: b.business_name||'', business_category: b.business_category||'', business_description: b.business_description||'',
        business_phone: b.business_phone||'', business_email: b.business_email||'', website: b.website||'',
        address: b.address||'', city: b.city||'', state: b.state||'', postal_code: b.postal_code||'',
        established_year: b.established_year ? String(b.established_year) : '',
      }); }
      else setHasBusiness(false);
    });
  }, []);

  const createOrUpdate = async (e: React.FormEvent, requestVerification=false) => {
    e.preventDefault();
    const errs: Record<string,string> = {};
    if (form.business_name.trim().length < 3) errs.business_name = 'Business name required.';
    if (!form.business_category) errs.business_category = 'Category required.';
    if (form.website && !/^https:\/\/.+/.test(form.website)) errs.website = 'Website must start with https://';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const sb = getSupabaseBrowser()!;
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) { setSaving(false); return; }
    const slug = form.business_name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'business';
    const payload: any = {
      user_id: auth.user.id,
      business_name: form.business_name.trim(),
      business_slug: slug,
      business_category: form.business_category,
      business_description: form.business_description || null,
      business_phone: form.business_phone || null,
      business_email: form.business_email || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      postal_code: form.postal_code || null,
      established_year: form.established_year ? Number(form.established_year) : null,
      business_logo: logo,
    };
    if (requestVerification) payload.verification_status = 'pending';
    const { data: existing } = await sb.from('business_profiles').select('id').eq('user_id', auth.user.id).maybeSingle();
    let businessId: string;
    if (existing) {
      const { error } = await sb.from('business_profiles').update(payload).eq('user_id', auth.user.id);
      if (error) { setErrors({ form: error.message }); setSaving(false); return; }
      businessId = existing.id;
    } else {
      const { data, error } = await sb.from('business_profiles').insert(payload).select('id').single();
      if (error) { setErrors({ form: error.message }); setSaving(false); return; }
      businessId = data.id;
    }
    if (requestVerification) {
      await sb.from('business_verification_requests').insert({ business_id: businessId, user_id: auth.user.id, status: 'pending' });
      setVerifying(true);
    }
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
    if (!existing) setHasBusiness(true);
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 3*1024*1024) return;
    const compressed = await compressImage(file);
    const sb = getSupabaseBrowser()!;
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return;
    const path = `${auth.user.id}/logo-${Date.now()}.webp`;
    await sb.storage.from('business-logos').upload(path, compressed, { contentType: 'image/webp', upsert: true });
    const { data: url } = sb.storage.from('business-logos').getPublicUrl(path);
    setLogo(url.publicUrl);
  };

  if (hasBusiness === null) return <div className="text-sm text-slate-400">Loading...</div>;

  if (!hasBusiness) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-black tracking-tight">Create Business Profile</h1>
        <p className="text-xs text-slate-500 mt-1">Set up your business to get a verified badge and business directory listing.</p>
        <form onSubmit={(e)=>createOrUpdate(e,false)} noValidate className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Business Name</label>
            <input value={form.business_name} onChange={(e)=>setForm({...form, business_name: e.target.value})} className={inputCls(errors.business_name)} placeholder="Acme Electronics" />
            {errors.business_name && <p className="text-xs text-red-600 mt-1">{errors.business_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Category</label>
            <input value={form.business_category} onChange={(e)=>setForm({...form, business_category: e.target.value})} className={inputCls(errors.business_category)} placeholder="Electronics" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Description</label>
            <textarea value={form.business_description} onChange={(e)=>setForm({...form, business_description: e.target.value})} rows={3} className={inputCls()} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Website</label>
              <input value={form.website} onChange={(e)=>setForm({...form, website: e.target.value})} placeholder="https://..." className={inputCls(errors.website)} />
              {errors.website && <p className="text-xs text-red-600 mt-1">{errors.website}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">City</label>
              <input value={form.city} onChange={(e)=>setForm({...form, city: e.target.value})} className={inputCls()} />
            </div>
          </div>
          {errors.form && <p className="text-xs text-red-600 font-bold">{errors.form}</p>}
          <button disabled={saving} className="w-full py-3 rounded-xl bg-[#E53935] text-white font-bold hover:bg-[#D32F2F] disabled:opacity-60">{saving?'Creating...':'Create Business Profile'}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">{business?.business_name} {business?.verification_status==='verified' && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><Award className="w-3 h-3" /> Verified</span>}</h1>
          <p className="text-xs text-slate-500 mt-1">Business Overview · <Link href={`/business/${business?.business_slug}`} className="text-[#E53935] font-semibold hover:underline">View public profile</Link></p>
        </div>
        {business?.verification_status==='verified' ? (
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">✓ Verified Business</span>
        ) : business?.verification_status==='pending' ? (
          <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Review</span>
        ) : (
          <button onClick={(e)=>createOrUpdate(e as any,true)} className="px-4 py-2 rounded-xl bg-[#E53935] text-white text-xs font-bold">Request Verification</button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center font-black text-xl">
            {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : <Store className="w-8 h-8 text-slate-400" />}
          </div>
          <label className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:border-[#E53935] cursor-pointer">
            Upload Logo
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogo} />
          </label>
          {business?.verification_status==='verified' && <span className="text-xs text-emerald-600 font-semibold">✓ Verified</span>}
        </div>
        <form onSubmit={(e)=>createOrUpdate(e,false)} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Business Name</label>
              <input value={form.business_name} onChange={(e)=>setForm({...form, business_name: e.target.value})} className={inputCls(errors.business_name)} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Category</label>
              <input value={form.business_category} onChange={(e)=>setForm({...form, business_category: e.target.value})} className={inputCls()} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Description</label>
            <textarea value={form.business_description} onChange={(e)=>setForm({...form, business_description: e.target.value})} rows={3} className={inputCls()} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">City</label>
              <input value={form.city} onChange={(e)=>setForm({...form, city: e.target.value})} className={inputCls()} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Website</label>
              <input value={form.website} onChange={(e)=>setForm({...form, website: e.target.value})} className={inputCls(errors.website)} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Est. Year</label>
              <input type="number" value={form.established_year} onChange={(e)=>setForm({...form, established_year: e.target.value})} className={inputCls()} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {saved && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" /> Saved!</span>}
            <button disabled={saving} className="px-6 py-3 rounded-xl bg-[#E53935] text-white font-bold disabled:opacity-60">{saving?'Saving...':'Save Changes'}</button>
          </div>
          {business?.verification_status!=='verified' && business?.verification_status!=='pending' && (
            <button type="button" onClick={(e)=>createOrUpdate(e as any,true)} className="w-full py-3 rounded-xl border-2 border-[#E53935] text-[#E53935] font-bold hover:bg-red-50">Request Business Verification</button>
          )}
          {business?.verification_status==='pending' && <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">Verification request submitted. Admin will review shortly.</p>}
        </form>
      </div>
    </div>
  );
}
