'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, PlusCircle, MessageSquare, UserRound } from 'lucide-react';

const ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/browse', label: 'Browse', icon: Compass },
  { href: '/post-ad', label: 'Post', icon: PlusCircle, center: true },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  // Hide on admin console and auth screens
  if (
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return null;
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
      aria-label="Mobile navigation"
    >
      <ul className="flex items-end justify-around h-16 px-1">
        {ITEMS.map((item) => {
          if (item.center) {
            return (
              <li key={item.href} className="relative -mt-6">
                <Link
                  href={item.href}
                  aria-label="Post an ad"
                  className="flex flex-col items-center justify-center w-14"
                >
                  <span className="w-14 h-14 rounded-full bg-[#E53935] hover:bg-[#D32F2F] text-white flex items-center justify-center shadow-lg shadow-red-300/60 ring-4 ring-white transition-transform active:scale-95">
                    <item.icon className="w-7 h-7" />
                  </span>
                  <span className="text-[10px] font-bold text-[#E53935] mt-0.5">Post</span>
                </Link>
              </li>
            );
          }
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 w-14 py-2 rounded-xl transition-colors ${
                  active ? 'text-[#E53935]' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}