'use client';

import React, { useMemo, useState } from 'react';
import {
  Bell,
  MessageSquare,
  CircleCheck,
  XCircle,
  Wallet,
  CalendarClock,
  Rocket,
} from 'lucide-react';
import { notifications as seed } from '@/data/accountData';
import { NotificationType } from '@/data/accountData';

const META: Record<NotificationType, { icon: React.ElementType; classes: string }> = {
  message: { icon: MessageSquare, classes: 'bg-sky-50 text-sky-600' },
  approved: { icon: CircleCheck, classes: 'bg-emerald-50 text-emerald-600' },
  rejected: { icon: XCircle, classes: 'bg-red-50 text-[#D32F2F]' },
  payment: { icon: Wallet, classes: 'bg-violet-50 text-violet-600' },
  expiring: { icon: CalendarClock, classes: 'bg-amber-50 text-amber-600' },
  promotion: { icon: Rocket, classes: 'bg-red-50 text-[#E53935]' },
};

export default function NotificationsPage() {
  const [items, setItems] = useState(seed);

  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, unread: false })));

  const toggleRead = (id: string) =>
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n)));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Notifications</h1>
          <p className="text-xs text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'You are all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="shrink-0 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold hover:border-slate-300 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <ul className="space-y-3">
        {items.map((n) => {
          const m = META[n.type];
          const Icon = m.icon;
          return (
            <li key={n.id}>
              <button
                onClick={() => toggleRead(n.id)}
                aria-pressed={n.unread}
                className={`w-full flex items-start gap-4 p-5 rounded-2xl border text-left transition-all ${
                  n.unread
                    ? 'bg-white border-red-100 shadow-sm ring-1 ring-red-50'
                    : 'bg-white/60 border-slate-100 hover:bg-white'
                }`}
              >
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${m.classes}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-grow">
                  <span className="flex items-center justify-between gap-3">
                    <span className={`text-sm ${n.unread ? 'font-bold text-[#0F172A]' : 'font-semibold text-slate-600'}`}>
                      {n.title}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                  </span>
                  <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{n.body}</span>
                </span>
                {n.unread ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E53935] shrink-0 mt-2" aria-label="Unread" />
                ) : (
                  <Bell className="w-4 h-4 text-slate-200 shrink-0 mt-1" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}