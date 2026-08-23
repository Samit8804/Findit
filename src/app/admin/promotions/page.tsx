'use client';

import React, { useState } from 'react';
import { Rocket, Crown, Building2, Zap } from 'lucide-react';
import { promotionConfigs as seed } from '@/data/adminData2';
import { ConfirmDialog, useToast } from '@/components/ui/Feedback';

const ICONS: Record<string, React.ElementType> = {
  boost: Zap,
  featured: Rocket,
  top: Crown,
  business: Building2,
  'business-pro': BadgeCheckIcon,
};

function BadgeCheckIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminPromotionsPage() {
  const toast = useToast();
  const [promos, setPromos] = useState(seed);
  const [confirm, setConfirm] = useState<{ id: string; name: string; next: boolean } | null>(null);

  const toggle = (id: string, next: boolean) => {
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, active: next } : p)));
    const name = promos.find((p) => p.id === id)?.name;
    toast(`${name} ${next ? 'activated' : 'deactivated'}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Promotions</h1>
        <p className="text-xs text-slate-500 mt-1">Manage pricing, duration and availability of visibility packages.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {promos.map((p) => {
          const Icon = ICONS[p.id] || Rocket;
          return (
            <div
              key={p.id}
              className={`rounded-2xl border-2 p-6 transition-all ${
                p.active ? 'border-slate-100 bg-white shadow-sm' : 'border-dashed border-slate-200 bg-slate-50 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <span className="w-11 h-11 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                {/* Active switch */}
                <button
                  role="switch"
                  aria-checked={p.active}
                  aria-label={`${p.active ? 'Deactivate' : 'Activate'} ${p.name}`}
                  onClick={() => setConfirm({ id: p.id, name: p.name, next: !p.active })}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${p.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${p.active ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <h3 className="font-black tracking-wide">{p.name}</h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-[#E53935]">₹{p.price}</span>
                <span className="text-xs text-slate-400 font-semibold">{p.duration}</span>
              </div>

              <ul className="mt-4 space-y-2 pt-4 border-t border-slate-100">
                {p.benefits.map((b) => (
                  <li key={b} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] shrink-0 mt-1.5" /> {b}
                  </li>
                ))}
              </ul>

              <p className={`mt-4 text-[11px] font-bold uppercase tracking-wider ${p.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                {p.active ? '● Active — purchasable' : '○ Inactive — hidden from users'}
              </p>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && toggle(confirm.id, confirm.next)}
        title={confirm?.next ? `Activate ${confirm?.name}?` : `Deactivate ${confirm?.name}?`}
        message={
          confirm?.next
            ? 'Users will immediately be able to purchase this package.'
            : 'This package will be hidden from pricing pages and checkout. Existing active promotions are unaffected.'
        }
        confirmLabel={confirm?.next ? 'Activate' : 'Deactivate'}
        danger={!confirm?.next}
      />
    </div>
  );
}