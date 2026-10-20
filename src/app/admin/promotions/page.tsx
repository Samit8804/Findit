'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Rocket, Crown, Building2, Zap, Loader2, MessageSquare } from 'lucide-react';
import {
  adminListPromotions,
  adminUpsertPromotion,
  adminTogglePromotion,
  AdminPromotion,
} from '@/services/payments';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { Modal, ConfirmDialog, useToast } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Form';

const ICONS: Record<string, React.ElementType> = {
  boost: Zap, featured: Rocket, top: Crown,
  business_subscription: Building2,
};

export default function AdminPromotionsPage() {
  const toast = useToast();
  const [promos, setPromos] = useState<AdminPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminPromotion | 'new' | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<AdminPromotion | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      setPromos(await adminListPromotions());
    } catch {
      toast('Failed to load promotions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (p: AdminPromotion) => {
    try {
      await adminTogglePromotion(p.id, !p.is_active);
      await load();
      toast(`${p.name} ${!p.is_active ? 'activated' : 'deactivated'}.`);
    } catch {
      flash('Unable to update promotion.');
    }
  };

  const flash = (msg: string) => {
    // lightweight inline feedback
    setSaving(true);
    setTimeout(() => setSaving(false), 800);
    void msg;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Promotions</h1>
          <p className="text-xs text-black mt-1">Prices and durations are served live to the pricing page and checkout.</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          disabled={!isSupabaseConfigured}
          className="shrink-0 px-5 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold shadow-md shadow-red-200 transition-colors disabled:opacity-50"
        >
          + New Promotion
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-56 bg-white border border-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100">
          <p className="text-sm font-semibold text-black">No promotions configured.</p>
          {!isSupabaseConfigured && <p className="text-xs text-black mt-1">Connect Supabase keys, then run migration 0007 for seed products.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {promos.map((p) => {
            const Icon = ICONS[p.type] || Rocket;
            return (
              <div key={p.id} className={`rounded-2xl border-2 p-6 transition-all ${p.is_active ? 'border-slate-100 bg-white shadow-sm' : 'border-dashed border-slate-200 bg-slate-50 opacity-75'}`}>
                <div className="flex items-start justify-between mb-4">
                  <span className="w-11 h-11 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditing(p)} title="Edit" className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-[#E53935] text-xs font-bold transition-colors">
                      Edit
                    </button>
                    <button onClick={() => setConfirmToggle(p)} title={p.is_active ? 'Deactivate' : 'Activate'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-black'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                <h3 className="font-black tracking-wide">{p.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-[#E53935]">₹{Number(p.price).toLocaleString('en-IN')}</span>
                  {p.duration_days && <span className="text-xs text-black font-semibold">/ {p.duration_days} days</span>}
                </div>
                {p.description && <p className="text-xs text-black mt-2 leading-relaxed">{p.description}</p>}
                <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  p.messaging_access ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  <MessageSquare className="w-3 h-3" />
                  {p.messaging_access ? 'Messaging included' : 'No messaging'}
                </div>
                <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold uppercase tracking-wider">
                  <span className={p.is_active ? 'text-emerald-600' : 'text-black'}>
                    {p.is_active ? '● Live on pricing page' : '○ Hidden from users'}
                  </span>
                  <span className="float-right text-black normal-case">{p.type}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / create modal */}
      <EditModal
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); void load(); }}
      />

      <ConfirmDialog
        open={confirmToggle !== null}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => confirmToggle && void toggle(confirmToggle)}
        title={confirmToggle?.is_active ? `Deactivate ${confirmToggle?.name}?` : `Activate ${confirmToggle?.name}?`}
        message={
          confirmToggle?.is_active
            ? 'This package will be hidden from the pricing page and checkout.'
            : 'Users will immediately be able to purchase this package.'
        }
        confirmLabel={confirmToggle?.is_active ? 'Deactivate' : 'Activate'}
        danger={!confirmToggle?.is_active}
      />

      {saving && <Loader2 className="hidden" />}
    </div>
  );
}

/* ---------------- Edit modal ---------------- */

function EditModal({
  target,
  onClose,
  onSaved,
}: {
  target: AdminPromotion | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isNew = target === 'new';
  const p = isNew || !target ? null : (target as AdminPromotion);

  const [form, setForm] = useState({ name: '', slug: '', type: 'featured', description: '', price: '', duration_days: '', messaging_access: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (target === 'new') setForm({ name: '', slug: '', type: 'featured', description: '', price: '', duration_days: '', messaging_access: false });
    else if (target)
      setForm({
        name: target.name,
        slug: target.slug,
        type: target.type,
        description: target.description || '',
        price: String(target.price),
        duration_days: String(target.duration_days ?? ''),
        messaging_access: target.messaging_access === true,
      });
  }, [target]);

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name required.';
    if (!form.price || Number(form.price) <= 0) errs.price = 'Valid price required.';
    if (form.messaging_access && Number(form.price) < 149) {
      errs.messaging_access = 'Messaging can only be enabled for plans priced ₹149 or more.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await adminUpsertPromotion({
        id: p?.id,
        name: form.name.trim(),
        slug: p?.slug ?? form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        type: form.type,
        description: form.description.trim(),
        price: Number(form.price),
        duration_days: form.duration_days ? Number(form.duration_days) : null,
        messaging_access: form.messaging_access,
      });
      toast(isNew ? 'Promotion created.' : 'Promotion updated.');
      onSaved();
    } catch (e: any) {
      toast(e.message.includes('permission') ? "You don't have permission." : e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={target !== null} onClose={onClose} title={isNew ? 'New Promotion' : `Edit — ${p?.name}`} size="md">
      <div className="space-y-4">
        <Input label="Name" name="promo-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
        <Input label="Price (₹)" name="promo-price" type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} error={errors.price} />
        <Input label="Duration (days)" name="promo-days" type="number" min={1} value={form.duration_days} onChange={(e) => setForm((f) => ({ ...f, duration_days: e.target.value }))} hint="Leave empty for subscriptions shown as monthly" />
        <Input label="Description" name="promo-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <label className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${form.messaging_access ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
          <input
            type="checkbox"
            checked={form.messaging_access}
            onChange={(e) => setForm((f) => ({ ...f, messaging_access: e.target.checked }))}
            className="mt-0.5 accent-[#E53935]"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-bold text-[#0F172A]">
              <MessageSquare className="w-4 h-4" /> Include messaging
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Buyers on this plan can start and send conversations. Requires a price of ₹149 or more.
            </span>
            {errors.messaging_access && <span className="block text-xs font-semibold text-[#D32F2F] mt-1">{errors.messaging_access}</span>}
          </span>
        </label>
        <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Promotion'}
        </button>
      </div>
    </Modal>
  );
}

import { X } from 'lucide-react';