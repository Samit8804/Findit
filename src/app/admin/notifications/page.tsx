'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { notifications as seed, NotificationType } from '@/data/accountData';

const META: Record<NotificationType | 'default', { icon: React.ElementType; classes: string }> = {
  message: { icon: Bell, classes: 'bg-sky-50 text-sky-600' },
  approved: { icon: Bell, classes: 'bg-emerald-50 text-emerald-600' },
  rejected: { icon: Bell, classes: 'bg-red-50 text-[#D32F2F]' },
  payment: { icon: Bell, classes: 'bg-violet-50 text-violet-600' },
  expiring: { icon: Bell, classes: 'bg-amber-50 text-amber-600' },
  promotion: { icon: Bell, classes: 'bg-red-50 text-[#E53935]' },
  default: { icon: Bell, classes: 'bg-slate-100 text-slate-500' },
};

export default function AdminNotificationsPage() {
  const items = [
    ...seed,
    { id: 'an1', type: 'payment' as NotificationType, title: 'New business subscription', body: 'GreenValley Nursery upgraded to BUSINESS PRO (₹999/mo).', time: '20 min ago', unread: true },
    { id: 'an2', type: 'rejected' as NotificationType, title: 'System alert', body: 'Payment gateway latency above threshold for 4 minutes.', time: '1 hour ago', unread: false },
    { id: 'an3', type: 'approved' as NotificationType, title: 'Sitemap regenerated', body: '12,840 URLs submitted to search engines.', time: '2 hours ago', unread: false },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Notifications</h1>
        <p className="text-xs text-slate-500 mt-1">Platform-wide system and moderation alerts.</p>
      </div>

      <ul className="space-y-3">
        {items.map((n) => {
          const m = META[n.type] || META.default;
          const Icon = m.icon;
          return (
            <li
              key={n.id}
              className={`flex items-start gap-4 p-5 rounded-2xl border transition-all ${
                n.unread ? 'bg-white border-red-100 shadow-sm ring-1 ring-red-50' : 'bg-white/60 border-slate-100'
              }`}
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${m.classes}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-grow">
                <span className="flex items-center justify-between gap-3">
                  <span className={`text-sm ${n.unread ? 'font-bold' : 'font-semibold text-slate-600'}`}>{n.title}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                </span>
                <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{n.body}</span>
              </span>
              {n.unread && <span className="w-2.5 h-2.5 rounded-full bg-[#E53935] shrink-0 mt-2" aria-label="Unread" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}