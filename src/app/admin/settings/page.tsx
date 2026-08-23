'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

const GROUPS = [
  {
    title: 'Moderation',
    items: [
      { key: 'autoApprove', label: 'Auto-approve trusted sellers', desc: 'Skip manual review for users with 10+ approved ads.' },
      { key: 'profanityFilter', label: 'Profanity filter', desc: 'Block listings containing flagged keywords.' },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { key: 'newRegistrations', label: 'Allow new registrations', desc: 'Disable to pause signups during maintenance.' },
      { key: 'businessSignups', label: 'Business directory signups', desc: 'Accept new business profile submissions.' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { key: 'maintenance', label: 'Maintenance mode banner', desc: 'Show a site-wide notice on public pages.' },
      { key: 'debug', label: 'Debug logging', desc: 'Verbose logs for the development team.' },
    ],
  },
] as const;

export default function AdminSettingsPage() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    autoApprove: true,
    profanityFilter: true,
    newRegistrations: true,
    businessSignups: true,
    maintenance: false,
    debug: false,
  });
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Settings</h1>
        <p className="text-xs text-slate-500 mt-1">Global platform configuration.</p>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">{g.title}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {g.items.map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-4 p-5 cursor-pointer">
                <span>
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">{item.desc}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={toggles[item.key]}
                  aria-label={item.label}
                  onClick={() => setToggles((t) => ({ ...t, [item.key]: !t[item.key] }))}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${toggles[item.key] ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${toggles[item.key] ? 'translate-x-5' : ''}`} />
                </button>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end gap-4">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mr-auto" role="status">
            <Check className="w-4 h-4" /> Settings saved
          </span>
        )}
        <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-[#E53935]">Back to public site</Link>
        <button
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          className="px-7 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-md shadow-red-200"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}