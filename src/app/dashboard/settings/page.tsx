'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  DEFAULT_SETTINGS,
  getMySettings,
  saveMySettings,
  UserSettings,
} from '@/services/settings';

const SETTINGS: { key: keyof UserSettings; label: string; desc: string }[] = [
  { key: 'emailNotifications', label: 'Email notifications', desc: 'Messages, ad approvals and payment receipts.' },
  { key: 'pushNotifications', label: 'Push notifications', desc: 'Real-time alerts on this device.' },
  { key: 'showPhoneOnAds', label: 'Show phone number on ads', desc: 'New ads default to showing your phone number.' },
  { key: 'whatsappContact', label: 'Enable WhatsApp contact', desc: 'New ads default to a WhatsApp contact button.' },
  { key: 'marketingEmails', label: 'Product updates & offers', desc: 'Occasional emails about new FindIt features.' },
];

const LOCAL_KEY = 'findit:settings';

function loadLocalSettings(): UserSettings | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const [toggles, setToggles] = useState<UserSettings>(() => {
    if (isSupabaseConfigured) return DEFAULT_SETTINGS;
    return (typeof window !== 'undefined' ? loadLocalSettings() : null) ?? DEFAULT_SETTINGS;
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [loadError, setLoadError] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    getMySettings()
      .then((settings) => {
        if (cancelled) return;
        if (!settings) {
          setSignedOut(true);
        } else {
          setToggles(settings);
          setSignedOut(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your settings. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setLoadError('');
    setReloadKey((k) => k + 1);
  };

  const toggle = (key: keyof UserSettings) => {
    setToggles((t) => ({ ...t, [key]: !t[key] }));
    setSaved(false);
    setSaveError('');
  };

  const save = async () => {
    if (signedOut) return;
    setSaving(true);
    setSaveError('');
    try {
      if (!isSupabaseConfigured) {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(toggles));
      } else {
        await saveMySettings(toggles);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings.', error);
      const message = error instanceof Error ? error.message : '';
      setSaveError(
        message === 'NOT_AUTHENTICATED'
          ? 'Please sign in to save your settings.'
          : 'Could not save your settings. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Settings</h1>
        <p className="text-xs text-slate-500 mt-1">Control how FindIt communicates with you.</p>
      </div>

      {signedOut && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Link href="/login" className="font-bold underline">Sign in</Link> to manage your settings.
        </div>
      )}

      {loadError && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-[#D32F2F]">
          {loadError}
          <button onClick={retry} className="rounded-lg bg-[#E53935] px-4 py-2 text-xs font-bold text-white">
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-5 animate-pulse">
              <span className="space-y-2">
                <span className="block h-4 w-40 rounded bg-slate-200" />
                <span className="block h-3 w-56 rounded bg-slate-100" />
              </span>
              <span className="h-6 w-11 rounded-full bg-slate-200" />
            </div>
          ))
        ) : (
          SETTINGS.map((s) => (
            <label key={s.key} className="flex items-center justify-between gap-4 p-5 cursor-pointer">
              <span>
                <span className="block text-sm font-bold">{s.label}</span>
                <span className="block text-xs text-slate-400 mt-0.5">{s.desc}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={toggles[s.key]}
                aria-label={s.label}
                disabled={signedOut}
                onClick={() => toggle(s.key)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
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
          ))
        )}
      </div>

      {saveError && (
        <p role="alert" className="mt-4 text-sm font-medium text-[#D32F2F]">{saveError}</p>
      )}

      <div className="mt-6 flex items-center justify-end gap-4">
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mr-auto" role="status">
            <Check className="w-4 h-4" /> Settings saved!
          </span>
        )}
        <button
          onClick={() => void save()}
          disabled={saving || loading || signedOut}
          className="px-7 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-60 text-white text-sm font-bold transition-colors shadow-md shadow-red-200"
        >
          {saving ? 'Saving...' : 'Save Settings'}
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
