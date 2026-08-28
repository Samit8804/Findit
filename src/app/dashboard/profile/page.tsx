'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Check, ShieldCheck, Store } from 'lucide-react';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { compressImage } from '@/lib/images';

const RESERVED = new Set(['admin','administrator','support','help','api','login','register','dashboard','settings','messages','system','seller','user','business','findit']);

function isValidUsername(v: string) {
  if (v.length < 3 || v.length > 30) return 'Username must be 3-30 characters.';
  if (!/^[a-z0-9-]+$/.test(v)) return 'Only lowercase letters, numbers and hyphens.';
  if (v.startsWith('-') || v.endsWith('-')) return 'Cannot start or end with hyphen.';
  if (RESERVED.has(v)) return 'This username is reserved.';
  return null;
}

const inputCls = (err?: string) =>
  `w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${
    err ? 'border-red-300 bg-red-50' : 'border-slate-200'
  }`;

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: 'Demo User',
    displayName: 'Demo User',
    username: '',
    email: 'demo.user@findit.example',
    phone: '+91 98765 43210',
    location: 'Sector 150, Noida, Uttar Pradesh',
    bio: 'Pro seller on FindIt since 2022. I list quality electronics, vehicles and property deals across Delhi NCR.',
    whatsapp: '+91 98765 43210',
    website: 'https://demostore.example.com',
    instagram: '@demouser',
    twitter: '@demouser',
    accountType: 'individual' as 'individual'|'business',
    privacyPhone: 'private' as 'public'|'registered_users'|'private',
    privacyEmail: 'private' as 'public'|'registered_users'|'private',
    privacyAddress: 'private' as 'public'|'registered_users'|'private',
    showRecentlySold: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [verified, setVerified] = useState({ email: false, phone: false, business: false });
  const [userId, setUserId] = useState<string | null>(null);

  // Load existing profile
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: p } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
      if (p) {
        setForm((f) => ({
          ...f,
          name: p.display_name || p.name || f.name,
          displayName: p.display_name || p.name || f.displayName,
          username: p.username || '',
          email: data.user.email || f.email,
          phone: p.phone || f.phone,
          location: p.location_text || f.location,
          bio: p.bio || f.bio,
          accountType: p.account_type || 'individual',
          privacyPhone: p.privacy_phone || 'private',
          privacyEmail: p.privacy_email || 'private',
          privacyAddress: p.privacy_address || 'private',
          showRecentlySold: p.show_recently_sold || false,
        }));
        setVerified({ email: !!p.email_verified, phone: !!p.phone_verified, business: !!p.business_verified });
        if (p.avatar_url) setAvatarUrl(p.avatar_url);
        // Auto-generate username if missing
        if (!p.username && (p.display_name || p.name)) {
          const base = (p.display_name || p.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20) || 'user';
          const { data: gen } = await sb.rpc('generate_username', { base });
          if (gen) setForm((f) => ({ ...f, username: gen }));
        }
      }
    });
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setAvatarError('Only JPG, PNG or WEBP allowed'); return; }
    if (file.size > 5*1024*1024) { setAvatarError('Max 5MB'); return; }
    setAvatarError('');
    if (!isSupabaseConfigured) { setAvatarUrl(URL.createObjectURL(file)); return; }
    const sb = getSupabaseBrowser()!;
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return;
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      const path = `${auth.user.id}/avatar-${Date.now()}.webp`;
      const { error: upErr } = await sb.storage.from('avatars').upload(path, compressed, { contentType: 'image/webp', upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      const cachedUrl = `${publicUrl}?v=${Date.now()}`;
      const { error: profErr } = await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', auth.user.id);
      if (profErr) throw profErr;
      setAvatarUrl(cachedUrl);
      window.dispatchEvent(new CustomEvent('avatar-updated'));
      setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch (e:any) {
      const raw = e?.message || JSON.stringify(e);
      setAvatarError(`Upload failed: ${raw}`);
    } finally { setUploadingAvatar(false); }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value } as any));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string,string> = {};
    if (form.displayName.trim().length < 3) errs.displayName = 'Display name too short.';
    const uErr = isValidUsername(form.username.toLowerCase());
    if (uErr) errs.username = uErr;
    if (form.bio.length > 500) errs.bio = 'Bio max 500 chars.';
    if (form.website && !/^https:\/\/.+/.test(form.website)) errs.website = 'Website must start with https://';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    if (!isSupabaseConfigured || !userId) {
      setTimeout(()=>{ setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000); },800);
      return;
    }
    const sb = getSupabaseBrowser()!;
    const { error } = await sb.from('profiles').update({
      display_name: form.displayName.trim(),
      username: form.username.toLowerCase().trim(),
      bio: form.bio.trim() || null,
      location_text: form.location.trim() || null,
      account_type: form.accountType,
      phone: form.phone.trim() || null,
      privacy_phone: form.privacyPhone,
      privacy_email: form.privacyEmail,
      privacy_address: form.privacyAddress,
      show_recently_sold: form.showRecentlySold,
    }).eq('id', userId);
    setSaving(false);
    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('username')) setErrors({ username: 'Username already taken.' });
      else setErrors({ form: error.message });
      return;
    }
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Profile</h1>
        <p className="text-xs text-slate-500 mt-1">Manage your public seller profile. {form.username && <Link href={`/seller/${form.username}`} className="text-[#E53935] font-semibold hover:underline">View public profile →</Link>}</p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-6">
        {/* Avatar + verification */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={form.displayName || form.username} width={80} height={80} className={`w-20 h-20 rounded-2xl object-cover shadow-lg ring-4 ring-white ${uploadingAvatar ? 'opacity-50 animate-pulse' : ''}`} />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#E53935] text-white font-black text-3xl flex items-center justify-center shadow-lg shadow-red-200">{(form.displayName||'U').charAt(0).toUpperCase()}</div>
            )}
            <button type="button" onClick={()=>avatarInputRef.current?.click()} disabled={uploadingAvatar} aria-label="Change profile photo" className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-[#0F172A] text-white hover:bg-slate-700 disabled:opacity-60">
              <Camera className="w-4 h-4" />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="flex-grow">
            <p className="font-bold">Profile Photo</p>
            {avatarError ? <p role="alert" className="text-xs text-[#D32F2F] font-semibold mt-1">{avatarError}</p> : <p className="text-xs text-slate-400 mt-1">{uploadingAvatar?'Uploading…':'JPG, PNG or WEBP · max 5MB'}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${verified.email?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-400'}`}><ShieldCheck className="w-3 h-3" /> Email {verified.email?'Verified':'Unverified'}</span>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${verified.phone?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-400'}`}><ShieldCheck className="w-3 h-3" /> Phone {verified.phone?'Verified':'Unverified'}</span>
              {verified.business && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-sky-50 text-sky-700"><ShieldCheck className="w-3 h-3" /> Business Verified</span>}
            </div>
          </div>
          <Link href="/dashboard/business" className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:border-[#E53935] hover:text-[#E53935]"><Store className="w-4 h-4" /> {form.accountType==='business'?'Manage Business':'Create Business'}</Link>
        </div>

        {/* Core fields */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="pf-displayName" className="block text-sm font-semibold text-slate-700 mb-1.5">Display Name</label>
              <input id="pf-displayName" value={form.displayName} onChange={set('displayName')} aria-invalid={!!errors.displayName} className={inputCls(errors.displayName)} placeholder="Rahul Sharma" />
              {errors.displayName && <p role="alert" className="text-xs text-red-600 mt-1">{errors.displayName}</p>}
            </div>
            <div>
              <label htmlFor="pf-username" className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-xs text-slate-500">/seller/</span>
                <input id="pf-username" value={form.username} onChange={set('username')} aria-invalid={!!errors.username} placeholder="rahul-sharma" className={`flex-grow px-4 py-3 border rounded-r-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${errors.username?'border-red-300 bg-red-50':'border-slate-200'}`} />
              </div>
              {errors.username && <p role="alert" className="text-xs text-red-600 mt-1">{errors.username}</p>}
              <p className="text-[11px] text-slate-400 mt-1">Lowercase letters, numbers, hyphens. 3-30 chars. No impersonation.</p>
            </div>
            <div>
              <label htmlFor="pf-location" className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
              <input id="pf-location" value={form.location} onChange={set('location')} placeholder="Noida, Uttar Pradesh" className={inputCls()} />
            </div>
            <div>
              <label htmlFor="pf-accountType" className="block text-sm font-semibold text-slate-700 mb-1.5">Account Type</label>
              <select id="pf-accountType" value={form.accountType} onChange={set('accountType')} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#E53935]">
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="pf-bio" className="block text-sm font-semibold text-slate-700 mb-1.5">Bio</label>
            <textarea id="pf-bio" rows={4} maxLength={500} value={form.bio} onChange={set('bio')} placeholder="Tell buyers about yourself..." className={`${inputCls(errors.bio)} resize-y`} />
            <p className="text-xs text-slate-400 mt-1">{form.bio.length}/500 {errors.bio && <span className="text-red-600 ml-2">{errors.bio}</span>}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="pf-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">Phone</label>
              <input id="pf-phone" type="tel" value={form.phone} onChange={set('phone')} className={inputCls()} />
            </div>
            <div>
              <label htmlFor="pf-whatsapp" className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp</label>
              <input id="pf-whatsapp" value={form.whatsapp} onChange={set('whatsapp')} className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="pf-website" className="block text-sm font-semibold text-slate-700 mb-1.5">Website</label>
              <input id="pf-website" type="url" value={form.website} onChange={set('website')} placeholder="https://..." className={inputCls(errors.website)} />
              {errors.website && <p className="text-xs text-red-600 mt-1">{errors.website}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Show Recently Sold</label>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input type="checkbox" checked={form.showRecentlySold} onChange={(e)=>setForm((f)=>({...f, showRecentlySold: e.target.checked}))} className="w-4 h-4 accent-[#E53935]" />
                <span className="text-xs text-slate-600">Display sold items on public profile (opt-in)</span>
              </label>
            </div>
          </div>
          <fieldset className="pt-4 border-t border-slate-100">
            <legend className="text-sm font-bold">Privacy Settings</legend>
            <p className="text-xs text-slate-400 mb-3">Control who sees your contact details. Default is private.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['privacyPhone','privacyEmail','privacyAddress'] as const).map((k)=>(
                <div key={k}>
                  <label htmlFor={k} className="block text-xs font-semibold text-slate-600 mb-1 capitalize">{k.replace('privacy','')}</label>
                  <select id={k} value={(form as any)[k]} onChange={set(k as any)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-white">
                    <option value="private">Private</option>
                    <option value="registered_users">Registered users only</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
          {errors.form && <p role="alert" className="text-xs text-red-600 font-bold">{errors.form}</p>}
        </div>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mr-auto" role="status"><Check className="w-4 h-4" /> Profile saved!</span>}
          <button type="submit" disabled={saving} className="px-7 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-sm font-bold shadow-md">
            {saving?'Saving...':'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
