'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icons from 'lucide-react';
import {
  MapPin,
  Heart,
  MessageSquare,
  User,
  PlusCircle,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { locations, categories } from '@/data/mockData';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { useUnread } from '@/components/providers/UnreadProvider';

function CategoryIcon({ name }: { name?: string | null }) {
  const key = (name || 'Folder') as string;
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[key] ||
    Icons.Folder;
  return <Icon className="w-5 h-5" />;
}

export const Header: React.FC = () => {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState('Noida');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  /* ---- Auth state: show the customer's name after login ---- */
  const [authUser, setAuthUser] = useState<{ name: string; email: string; avatarUrl?: string } | null>(
    isSupabaseConfigured ? null : { name: 'Demo User', email: 'demo@findit.example' }
  );
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unread = useUnread();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;

    let active = true;

    const loadProfile = async (
      userId: string,
      metaName?: string
    ): Promise<{ name: string; avatarUrl?: string } | undefined> => {
      try {
        const { data } = await sb
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', userId)
          .maybeSingle();
        if (!data && !metaName) return { name: userId.slice(0, 6) };
        return {
          name: (metaName && !metaName.includes('@') ? metaName : data?.name) || userId.slice(0, 6),
          avatarUrl: data?.avatar_url || undefined,
        };
      } catch {
        return metaName ? { name: metaName } : { name: userId.slice(0, 6) };
      }
    };

    const sync = async (sessionUser: any | null) => {
      if (!active) return;
      if (!sessionUser) {
        setAuthUser(null);
        return;
      }
      const metaName: string | undefined =
        sessionUser.user_metadata?.name ||
        sessionUser.user_metadata?.full_name;
      const email: string = sessionUser.email ?? '';
      const profile = await loadProfile(sessionUser.id, metaName);
      setAuthUser({
        name: profile?.name || email.split('@')[0],
        email,
        avatarUrl: profile?.avatarUrl,
      });
    };

    sb.auth.getSession().then(({ data }) => void sync(data.session?.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => void sync(session?.user ?? null));

    // Profile page dispatches this after an avatar upload
    const onAvatarUpdated = () => {
      sb.auth.getSession().then(({ data }) => void sync(data.session?.user ?? null));
    };
    window.addEventListener('avatar-updated', onAvatarUpdated);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('avatar-updated', onAvatarUpdated);
    };
  }, []);

  /* Close menus on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoriesRef.current && !categoriesRef.current.contains(e.target as Node)) {
        setShowCategories(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    if (isSupabaseConfigured) {
      await getSupabaseBrowser()?.auth.signOut();
    }
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Location */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-[#E53935] flex items-center justify-center text-white font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                F
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-[#0F172A] leading-none">
                  Find<span className="text-[#E53935]">It</span>
                </span>
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Marketplace
                </span>
              </div>
            </Link>

            {/* Location Selector */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl text-xs font-semibold text-[#0F172A] transition-colors border border-slate-200"
              >
                <MapPin className="w-4 h-4 text-[#E53935]" />
                <span>{selectedLocation}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showLocationDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        setSelectedLocation(loc.name);
                        setShowLocationDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-[#E53935]"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <Link href="/browse" className="hover:text-[#E53935] transition-colors">
              Browse Ads
            </Link>
            <Link href="/business" className="hover:text-[#E53935] transition-colors">
              Businesses
            </Link>

            {/* Categories Mega Menu */}
            <div ref={categoriesRef} className="relative">
              <button
                onClick={() => setShowCategories(!showCategories)}
                className={`flex items-center gap-1 transition-colors ${
                  showCategories ? 'text-[#E53935]' : 'hover:text-[#E53935]'
                }`}
              >
                Categories
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showCategories ? 'rotate-180' : ''}`}
                />
              </button>

              {showCategories && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[860px] bg-white rounded-2xl shadow-2xl border border-slate-100 p-7 z-50">
                  <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                    {categories.map((cat) => (
                      <div key={cat.id}>
                        <Link
                          href={`/category/${cat.slug}`}
                          onClick={() => setShowCategories(false)}
                          className="flex items-center gap-3 group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center shrink-0 group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                            <CategoryIcon name={cat.icon} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0F172A] group-hover:text-[#E53935] transition-colors truncate">
                              {cat.name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              {cat.listingCount.toLocaleString()} ads Â· {cat.subcategories.length} subcategories
                            </p>
                          </div>
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-[52px]">
                          {cat.subcategories.slice(0, 4).map((sub) => (
                            <Link
                              key={sub.id}
                              href={`/browse?category=${cat.slug}&subcategory=${sub.slug}`}
                              onClick={() => setShowCategories(false)}
                              className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-semibold text-slate-500 hover:text-[#E53935] hover:border-red-100 hover:bg-red-50 transition-colors"
                            >
                              {sub.name.length > 22 ? sub.name.slice(0, 20) + 'â€¦' : sub.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Can&apos;t find what you need? Explore the full catalogue.
                    </span>
                    <Link
                      href="/browse"
                      onClick={() => setShowCategories(false)}
                      className="text-xs font-bold text-[#E53935] hover:underline flex items-center gap-1"
                    >
                      View All Categories <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link href="/dashboard/my-ads" className="hover:text-[#E53935] transition-colors">
              My Ads
            </Link>
            <Link href="/dashboard/favorites" className="hover:text-[#E53935] transition-colors flex items-center gap-1.5">
              <Heart className="w-4 h-4" /> Favourites
            </Link>
            <Link href="/dashboard/messages" className={`relative hover:text-[#E53935] transition-colors flex items-center gap-1.5 ${unread.messages > 0 ? 'text-[#0F172A]' : ''}`}>
              <MessageSquare className="w-4 h-4" /> Messages
              {unread.messages > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E53935] text-white text-[10px] font-bold flex items-center justify-center">
                  {unread.messages > 99 ? '99+' : unread.messages}
                </span>
              )}
            </Link>
            <Link href="/dashboard/notifications" title="Notifications" className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
              <Icons.Bell className="w-4.5 h-4.5" />
              {unread.notifications > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#E53935] ring-2 ring-white" />
              )}
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {authUser ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-colors"
                >
                  <span className="w-7 h-7 rounded-lg bg-[#E53935] text-white text-xs font-black flex items-center justify-center uppercase overflow-hidden">
                    {authUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={authUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      authUser.name.charAt(0)
                    )}
                  </span>
                  <span className="max-w-[120px] truncate text-sm font-semibold text-[#0F172A]">
                    {authUser.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-bold truncate">{authUser.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{authUser.email}</p>
                    </div>
                    <Link href="/dashboard" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-[#E53935] transition-colors">
                      <Icons.LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    <Link href="/dashboard/my-ads" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-[#E53935] transition-colors">
                      <Icons.Layers className="w-4 h-4" /> My Ads
                    </Link>
                    <Link href="/dashboard/favorites" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-[#E53935] transition-colors">
                      <Heart className="w-4 h-4" /> Favourites
                    </Link>
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[#D32F2F] hover:bg-red-50 transition-colors">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-[#E53935] flex items-center gap-1.5 transition-colors">
                <User className="w-4 h-4" /> Login
              </Link>
            )}
            <Link href="/post-ad">
              <Button variant="primary" size="md" className="gap-2 shadow-md">
                <PlusCircle className="w-4 h-4" /> Post an Ad
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link href="/post-ad">
              <Button variant="primary" size="sm" className="gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> Post
              </Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 text-[#0F172A]"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-100 px-6 py-6 space-y-4">
          <div className="flex flex-col space-y-3 font-semibold text-slate-700">
            <Link
              href="/browse"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E53935] py-2 border-b border-slate-50"
            >
              Browse Ads
            </Link>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 pt-2">Categories</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700 hover:text-[#E53935] hover:border-red-100"
                >
                  <span className="text-[#E53935]">
                    <CategoryIcon name={cat.icon} />
                  </span>
                  {cat.name}
                </Link>
              ))}
            </div>
            <Link
              href="/browse"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E53935] py-2 border-b border-slate-50 flex items-center gap-2 text-sm"
            >
              View All Categories
            </Link>
            <Link
              href="/dashboard/my-ads"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E53935] py-2 border-b border-slate-50"
            >
              My Ads
            </Link>
            <Link
              href="/dashboard/favorites"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E53935] py-2 border-b border-slate-50 flex items-center gap-2"
            >
              <Heart className="w-4 h-4" /> Favourites
            </Link>
            <Link
              href="/dashboard/messages"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E53935] py-2 border-b border-slate-50 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" /> Messages
            </Link>
            {authUser ? (
              <>
                <div className="flex items-center gap-3 px-1 pt-2 pb-1">
                  <span className="w-9 h-9 rounded-xl bg-[#E53935] text-white text-sm font-black flex items-center justify-center uppercase">
                    {authUser.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{authUser.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{authUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void handleSignOut();
                  }}
                  className="flex items-center gap-2 text-sm font-semibold text-[#D32F2F] py-2"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#E53935] py-2 flex items-center gap-2"
              >
                <User className="w-4 h-4" /> Login / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

