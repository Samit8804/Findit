'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Layers,
  Flag,
  Building2,
  Wallet,
  Rocket,
  Megaphone,
  Tags,
  MapPin,
  Search,
  Bell,
  Settings,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/ads', label: 'Advertisements', icon: Layers },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/businesses', label: 'Businesses', icon: Building2 },
  { href: '/admin/payments', label: 'Payments', icon: Wallet },
  { href: '/admin/promotions', label: 'Promotions', icon: Rocket },
  { href: '/admin/advertising', label: 'Advertising', icon: Megaphone },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
  { href: '/admin/locations', label: 'Locations', icon: MapPin },
  { href: '/admin/seo', label: 'SEO', icon: Search },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Admin navigation">
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
              active
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#E53935]' : ''}`} />
            {item.label}
            {item.label === 'Reports' && (
              <span className="ml-auto px-1.5 min-w-[18px] h-4 rounded-full bg-[#E53935] text-white text-[10px] font-bold flex items-center justify-center">
                5
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-[#0F172A] p-4 sticky top-0 h-screen overflow-y-auto">
        <Link href="/" className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#E53935] flex items-center justify-center text-white font-black">F</div>
          <div>
            <p className="text-white font-black leading-none">Find<span className="text-[#E53935]">It</span></p>
            <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mt-0.5">Admin Panel</p>
          </div>
        </Link>
        {nav}
        <div className="mt-auto pt-4 border-t border-white/10">
          <Link href="/" className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
            <ShieldCheck className="w-3.5 h-3.5" /> Back to public site
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-grow min-w-0 flex flex-col">
        {/* Admin top bar */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setOpen(true)} className="lg:hidden p-2 rounded-xl bg-slate-100" aria-label="Open admin menu">
                <Menu className="w-5 h-5" />
              </button>
              <span className="text-sm font-black text-[#0F172A] hidden sm:block">Admin Console</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500" aria-label="Notifications">
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#E53935]" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#E53935] text-white font-black text-sm flex items-center justify-center" title="Admin">
                A
              </div>
            </div>
          </div>
        </header>

        <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[85] bg-black/50 backdrop-blur-xs" onClick={() => setOpen(false)}>
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-[#0F172A] p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-white font-black">Find<span className="text-[#E53935]">It</span> Admin</span>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </div>
  );
}