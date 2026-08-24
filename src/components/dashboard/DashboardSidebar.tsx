'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Heart,
  MessageSquare,
  Bell,
  Wallet,
  UserRound,
  Settings,
  PlusCircle,
  Menu,
  X,
} from 'lucide-react';
import { useUnread } from '@/components/providers/UnreadProvider';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/my-ads', label: 'My Ads', icon: Layers },
  { href: '/dashboard/favorites', label: 'Favorites', icon: Heart },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/payments', label: 'Payments', icon: Wallet },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export const DashboardSidebar: React.FC<{ userName?: string }> = ({ userName = 'Demo' }) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = useUnread();

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const badgeFor = (href: string): number =>
    href === '/dashboard/messages' ? unread.messages
    : href === '/dashboard/notifications' ? unread.notifications
    : 0;

  const links = (
    <nav className="flex flex-col gap-1" aria-label="Dashboard navigation">
      {NAV.map((item) => {
        const active = isActive(item.href);
        const count = badgeFor(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              active
                ? 'bg-[#E53935] text-white shadow-md shadow-red-100'
                : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]'
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
            {count > 0 && (
              <span className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                active ? 'bg-white text-[#E53935]' : 'bg-[#E53935] text-white'
              }`}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        );
      })}

      <div className="pt-4 mt-4 border-t border-slate-100">
        <Link
          href="/post-ad"
          onClick={() => setMobileOpen(false)}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold shadow-lg shadow-red-200 transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> Post an Ad
        </Link>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0">
        <div className="sticky top-24 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          {/* Mini profile */}
          <div className="flex items-center gap-3 px-2 py-3 mb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center font-black shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{userName}</p>
              <p className="text-[11px] text-slate-400">Pro Seller</p>
            </div>
          </div>
          {links}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden mb-6 flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl bg-slate-100"
          aria-label="Open dashboard menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold">My Account</span>
        <Link href="/post-ad" className="p-2 rounded-xl bg-[#E53935] text-white" aria-label="Post an ad">
          <PlusCircle className="w-5 h-5" />
        </Link>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-white p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="font-black">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            {links}
          </div>
        </div>
      )}
    </>
  );
};