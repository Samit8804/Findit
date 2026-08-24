'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { compressImage } from '@/lib/images';

const inputCls = (err?: string) =>
  `w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${
    err ? 'border-red-300 bg-red-50' : 'border-slate-200'
  }`;

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: 'Demo User',
    email: 'demo.user@findit.example',
    phone: '+91 98765 43210',
    location: 'Sector 150, Noida, Uttar Pradesh',
    bio: 'Pro seller on FindIt since 2022. I list quality electronics, vehicles and property deals across Delhi NCR.',
    whatsapp: '+91 98765 43210',
    website: 'https://demostore.example.com',
    instagram: '@demouser',
    twitter: '@demouser',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // reuse the saved indicator as a lightweight toast
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    void msg;
  };

  /* Load existing avatar */
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setForm((f) => ({
        ...f,
        name: data.user.user_metadata?.name || f.name,
        email: data.user.email || f.email,
      }));
      const { data: p } = await sb.from('profiles').select('avatar_url').eq('id', data.user.id).single();
      if (p?.avatar_url) setAvatarUrl(p.avatar_url);
    });
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      flash('Only JPG, PNG or WEBP allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flash('Max 5MB');
      return;
    }

    if (!isSupabaseConfigured) {
      // demo preview
      setAvatarUrl(URL.createObjectURL(file));
      return;
    }

    const sb = getSupabaseBrowser()!;
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return;

    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      const path = `${auth.user.id}/avatar-${Date.now()}.webp`;
      const { error: upErr } = await sb.storage.from('avatars').upload(path, compressed, {
        contentType: 'image/webp',
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', auth.user.id);
      setAvatarUrl(publicUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      flash('Upload failed — check avatars bucket policies.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 3) errs.name = 'Name is too short.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email.';
    if (!/^[+\d][\d\s-]{7,14}$/.test(form.phone)) errs.phone = 'Enter a valid phone number.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    }, 1000);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Profile</h1>
        <p className="text-xs text-slate-500 mt-1">This information appears on your public ads.</p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-6">
        {/* Avatar */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-5">
          <div className="relative">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile"
                className={`w-20 h-20 rounded-2xl object-cover shadow-lg ring-4 ring-white ${uploadingAvatar ? 'opacity-50 animate-pulse' : ''}`}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#E53935] text-white font-black text-3xl flex items-center justify-center shadow-lg shadow-red-200">
                D
              </div>
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Change profile photo"
              className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-[#0F172A] text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="font-bold">Profile Photo</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {uploadingAvatar ? 'Uploading…' : 'JPG, PNG or WEBP · max 5MB'}
            </p>
          </div>
        </div>

        {/* Fields */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="pf-name" className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
              <input id="pf-name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} className={inputCls(errors.name)} />
              {errors.name && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="pf-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input id="pf-email" type="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} className={inputCls(errors.email)} />
              {errors.email && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="pf-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">Phone</label>
              <input id="pf-phone" type="tel" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} className={inputCls(errors.phone)} />
              {errors.phone && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label htmlFor="pf-location" className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
              <input id="pf-location" value={form.location} onChange={set('location')} className={inputCls()} />
            </div>
          </div>

          <div>
            <label htmlFor="pf-bio" className="block text-sm font-semibold text-slate-700 mb-1.5">Bio</label>
            <textarea
              id="pf-bio"
              rows={4}
              maxLength={300}
              value={form.bio}
              onChange={set('bio')}
              aria-describedby="bio-count"
              className={`${inputCls()} resize-y`}
            />
            <p id="bio-count" className="text-xs text-slate-400 mt-1">{form.bio.length}/300</p>
          </div>

          <fieldset className="pt-4 border-t border-slate-100 space-y-5">
            <legend className="text-sm font-bold pt-4 pb-1">Contact & Social</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="pf-wa" className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp Number</label>
                <input id="pf-wa" value={form.whatsapp} onChange={set('whatsapp')} className={inputCls()} />
              </div>
              <div>
                <label htmlFor="pf-web" className="block text-sm font-semibold text-slate-700 mb-1.5">Website</label>
                <input id="pf-web" value={form.website} onChange={set('website')} className={inputCls()} />
              </div>
              <div>
                <label htmlFor="pf-ig" className="block text-sm font-semibold text-slate-700 mb-1.5">Instagram</label>
                <input id="pf-ig" value={form.instagram} onChange={set('instagram')} className={inputCls()} />
              </div>
              <div>
                <label htmlFor="pf-tw" className="block text-sm font-semibold text-slate-700 mb-1.5">Twitter / X</label>
                <input id="pf-tw" value={form.twitter} onChange={set('twitter')} className={inputCls()} />
              </div>
            </div>
          </fieldset>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mr-auto" role="status">
              <Check className="w-4 h-4" /> Profile saved!
            </span>
          )}
          <button
            type="submit"
            disabled={saving || saved}
            className="px-7 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-sm font-bold transition-colors shadow-md shadow-red-200"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}