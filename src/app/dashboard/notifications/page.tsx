'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Bell,
  MessageSquare,
  CircleCheck,
  XCircle,
  Wallet,
  CalendarClock,
  Rocket,
  CheckCheck,
} from 'lucide-react';
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationLink,
  AppNotification,
} from '@/services/notifications';
import { isSupabaseConfigured } from '@/lib/supabase/client';

const META: Record<string, { icon: React.ElementType; classes: string }> = {
  new_message: { icon: MessageSquare, classes: 'bg-sky-50 text-sky-600' },
  ad_approved: { icon: CircleCheck, classes: 'bg-emerald-50 text-emerald-600' },
  approved: { icon: CircleCheck, classes: 'bg-emerald-50 text-emerald-600' },
  ad_rejected: { icon: XCircle, classes: 'bg-red-50 text-[#D32F2F]' },
  rejected: { icon: XCircle, classes: 'bg-red-50 text-[#D32F2F]' },
  payment_success: { icon: Wallet, classes: 'bg-violet-50 text-violet-600' },
  payment_failed: { icon: Wallet, classes: 'bg-red-50 text-[#D32F2F]' },
  ad_expiring: { icon: CalendarClock, classes: 'bg-amber-50 text-amber-600' },
  expiring: { icon: CalendarClock, classes: 'bg-amber-50 text-amber-600' },
  promotion_activated: { icon: Rocket, classes: 'bg-red-50 text-[#E53935]' },
  promotion: { icon: Rocket, classes: 'bg-red-50 text-[#E53935]' },
  pending: { icon: Bell, classes: 'bg-amber-50 text-amber-600' },
};

function NotificationsContent() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      setItems(await getMyNotifications());
      setError('');
    } catch {
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unreadCount = items.filter((n) => !n.read).length;

  const openNotification = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    router.push(notificationLink(n));
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Notifications</h1>
          <p className="text-xs text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : "You're all caught up."}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={async () => {
              await markAllNotificationsRead();
              setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            }}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold hover:border-slate-300 transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-100">
              <div className="w-11 h-11 rounded-xl bg-slate-200 shrink-0" />
              <div className="flex-grow space-y-2">
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="h-3 w-3/4 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-red-100">
          <p className="text-sm font-semibold text-[#D32F2F]">{error}</p>
          <button onClick={() => void load()} className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold">Retry</button>
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center p-14 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold mb-1">You're all caught up.</h3>
          <p className="text-sm text-slate-500 max-w-xs">New activity on your ads and messages will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const m = META[n.type] || META.pending;
            const Icon = m.icon;
            const inner = (
              <>
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${m.classes}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-grow">
                  <span className="flex items-center justify-between gap-3">
                    <span className={`text-sm ${n.read ? 'font-semibold text-slate-600' : 'font-bold text-[#0F172A]'}`}>{n.title}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                  </span>
                  {n.body && <span className="block text-xs text-slate-500 mt-1 leading-relaxed truncate">{n.body}</span>}
                </span>
                {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-[#E53935] shrink-0 mt-2" aria-label="Unread" />}
              </>
            );
            const cls = `w-full flex items-start gap-4 p-5 rounded-2xl border text-left transition-all ${
              n.read ? 'bg-white/60 border-slate-100 hover:bg-white' : 'bg-white border-red-100 shadow-sm ring-1 ring-red-50'
            }`;
            return (
              <li key={n.id}>
                {/* Internal links navigate via router after marking read */}
                <button onClick={() => void openNotification(n)} aria-pressed={!n.read} className={cls}>
                  {inner}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Deep-link support: /dashboard/notifications?c=... handled by messages page */}
      {searchParams.get('c') && !searchParams.get('silent') && null}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-400">Loading...</div>}>
      <NotificationsContent />
    </Suspense>
  );
}