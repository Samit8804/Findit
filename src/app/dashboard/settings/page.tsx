'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

const SETTINGS = [
  { key: 'emailNotif', label: 'Email notifications', desc: 'Messages, ad approvals and payment receipts.' },
  { key: 'pushNotif', label: 'Push notifications', desc: 'Real-time alerts on this device.' },
  { key: 'showPhone', label: 'Show phone number on ads', desc: 'Buyers can call you directly from listings.' },
  { key: 'whatsapp', label: 'Enable WhatsApp contact', desc: 'Adds a WhatsApp button to your ads.' },
  { key: 'marketing', label: 'Product updates & offers', desc: 'Occasional emails about new FindIt features.' },
] as const;

export default function SettingsPage() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    emailNotif: true,
    pushNotif: true,
    showPhone: false,
    whatsapp: true,
    marketing: false,
  });
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Settings</h1>
        <p className="text-xs text-slate-500 mt-1">Control how FindIt communicates with you.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
        {SETTINGS.map((s) => (
          <label key={s.key} className="flex items-center justify-between gap-4 p-5 cursor-pointer">
            <span>
              <span className="block text-sm font-bold">{s.label}</span>
              <span className="block text-xs text-slate-400 mt-0.5">{s.desc}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={toggles[s.key]}
              onClick={() => setToggles((t) => ({ ...t, [s.key]: !t[s.key] }))}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                toggles[s.key] ? 'bg-[#E53935]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  toggles[s.key] ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </label>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-end gap-4">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mr-auto" role="status">
            <Check className="w-4 h-4" /> Settings updated!
          </span>
        )}
        <button
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          className="px-7 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-md shadow-red-200"
        >
          Save Settings
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-8">
        Looking for your listings? Head over to{' '}
        <Link href="/dashboard/my-ads" className="text-[#E53935] font-semibold hover:underline">
          My Ads
        </Link>
        .
      </p>
    </div>
  );
}