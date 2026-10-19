'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { addFavorite, listMyFavoriteIds, removeFavorite } from '@/services/ads';

interface FavoritesState {
  /** Ids of ads the signed-in user has saved in Supabase. */
  favoriteIds: ReadonlySet<string>;
  /** True while the session/favorites are being restored. */
  loading: boolean;
  isFavorite: (adId: string) => boolean;
  /** Persists the toggle, then resolves to the new state. Throws on failure. */
  toggleFavorite: (adId: string) => Promise<boolean>;
  /** Persists removal. Throws on failure. */
  removeFavorite: (adId: string) => Promise<void>;
  /** Re-reads favorites from Supabase. */
  refresh: () => Promise<void>;
}

const FavoritesCtx = createContext<FavoritesState>({
  favoriteIds: new Set(),
  loading: false,
  isFavorite: () => false,
  toggleFavorite: async () => {
    throw new Error('NOT_AUTHENTICATED');
  },
  removeFavorite: async () => {
    throw new Error('NOT_AUTHENTICATED');
  },
  refresh: async () => {},
});

export function useFavorites() {
  return useContext(FavoritesCtx);
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const idsRef = useRef<ReadonlySet<string>>(favoriteIds);
  const queuesRef = useRef(new Map<string, Promise<unknown>>());

  const replaceIds = useCallback((next: ReadonlySet<string>) => {
    idsRef.current = next;
    setFavoriteIds(next);
  }, []);

  const applyOptimistic = useCallback(
    (adId: string, favorited: boolean) => {
      const next = new Set(idsRef.current);
      if (favorited) next.add(adId);
      else next.delete(adId);
      replaceIds(next);
    },
    [replaceIds]
  );

  const loadForUser = useCallback(
    async (userId: string | null) => {
      if (!userId) {
        replaceIds(new Set<string>());
        setLoading(false);
        return;
      }
      try {
        const ids = await listMyFavoriteIds();
        replaceIds(new Set(ids));
      } catch {
        // Keep the last known state; individual actions still surface errors.
      } finally {
        setLoading(false);
      }
    },
    [replaceIds]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    let active = true;

    sb.auth.getSession().then(({ data }) => {
      if (active) void loadForUser(data.session?.user?.id ?? null);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      // Defer: awaiting Supabase calls inside this callback can deadlock the auth lock.
      const userId = session?.user?.id ?? null;
      setTimeout(() => {
        if (active) void loadForUser(userId);
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadForUser]);

  /** Serializes operations per ad so rapid clicks cannot race each other. */
  const enqueue = useCallback(<T,>(adId: string, task: () => Promise<T>): Promise<T> => {
    const previous = queuesRef.current.get(adId) ?? Promise.resolve();
    const next = previous.then(task, task);
    const tail = next.then(
      () => undefined,
      () => undefined
    );
    queuesRef.current.set(adId, tail);
    void tail.then(() => {
      if (queuesRef.current.get(adId) === tail) queuesRef.current.delete(adId);
    });
    return next;
  }, []);

  const toggleFavorite = useCallback(
    (adId: string): Promise<boolean> =>
      enqueue(adId, async () => {
        const wasFavorite = idsRef.current.has(adId);
        applyOptimistic(adId, !wasFavorite);
        try {
          if (wasFavorite) await removeFavorite(adId);
          else await addFavorite(adId);
          return !wasFavorite;
        } catch (error) {
          applyOptimistic(adId, wasFavorite);
          throw error;
        }
      }),
    [applyOptimistic, enqueue]
  );

  const removeFavoritePersisted = useCallback(
    (adId: string): Promise<void> =>
      enqueue(adId, async () => {
        const wasFavorite = idsRef.current.has(adId);
        applyOptimistic(adId, false);
        try {
          await removeFavorite(adId);
        } catch (error) {
          if (wasFavorite) applyOptimistic(adId, true);
          throw error;
        }
      }),
    [applyOptimistic, enqueue]
  );

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    await loadForUser(data.session?.user?.id ?? null);
  }, [loadForUser]);

  const isFavorite = useCallback((adId: string) => favoriteIds.has(adId), [favoriteIds]);

  const value = useMemo<FavoritesState>(
    () => ({
      favoriteIds,
      loading,
      isFavorite,
      toggleFavorite,
      removeFavorite: removeFavoritePersisted,
      refresh,
    }),
    [favoriteIds, loading, isFavorite, toggleFavorite, removeFavoritePersisted, refresh]
  );

  return <FavoritesCtx.Provider value={value}>{children}</FavoritesCtx.Provider>;
}
