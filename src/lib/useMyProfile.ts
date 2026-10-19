'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { getMyProfile, MyProfile } from '@/services/profile';

/**
 * Loads the signed-in user's profile for dashboard chrome (sidebar name,
 * greeting, plan label). Re-loads on auth changes and after the profile
 * page saves or uploads an avatar ('profile-updated' / 'avatar-updated').
 */
export function useMyProfile() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const refresh = useCallback(() => {
    getMyProfile()
      .then((p) => { if (activeRef.current) setProfile(p); })
      .catch(() => { if (activeRef.current) setProfile(null); })
      .finally(() => { if (activeRef.current) setLoading(false); });
  }, []);

  useEffect(() => {
    activeRef.current = true;
    getMyProfile()
      .then((p) => { if (activeRef.current) setProfile(p); })
      .catch(() => { if (activeRef.current) setProfile(null); })
      .finally(() => { if (activeRef.current) setLoading(false); });

    const onUpdated = () => refresh();
    window.addEventListener('profile-updated', onUpdated);
    window.addEventListener('avatar-updated', onUpdated);

    const sb = getSupabaseBrowser();
    const sub = sb?.auth.onAuthStateChange(() => refresh());

    return () => {
      activeRef.current = false;
      window.removeEventListener('profile-updated', onUpdated);
      window.removeEventListener('avatar-updated', onUpdated);
      sub?.data.subscription.unsubscribe();
    };
  }, [refresh]);

  return { profile, loading, refresh };
}
