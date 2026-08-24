'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getUnreadCounts } from '@/services/messaging';
import { isSupabaseConfigured } from '@/lib/supabase/client';

interface UnreadState {
  messages: number;
  notifications: number;
  refresh: () => void;
}

const UnreadCtx = createContext<UnreadState>({ messages: 0, notifications: 0, refresh: () => {} });

export function useUnread() {
  return useContext(UnreadCtx);
}

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });

  const refresh = useCallback(() => {
    if (!isSupabaseConfigured) return;
    getUnreadCounts()
      .then(setCounts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void refresh();
    const timer = setInterval(refresh, 30000); // light polling; realtime covers chat
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return <UnreadCtx.Provider value={{ ...counts, refresh }}>{children}</UnreadCtx.Provider>;
}