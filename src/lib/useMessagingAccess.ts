'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { MessagingAccess } from '@/lib/messagingEntitlement';
import { getMyMessagingAccess } from '@/services/messagingAccess';

export function useMessagingAccess() {
  const [access, setAccess] = useState<MessagingAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getMyMessagingAccess()
      .then((a) => { if (activeRef.current) setAccess(a); })
      .catch(() => { if (activeRef.current) setAccess(null); })
      .finally(() => { if (activeRef.current) setLoading(false); });
  }, []);

  useEffect(() => {
    activeRef.current = true;
    getMyMessagingAccess()
      .then((a) => { if (activeRef.current) setAccess(a); })
      .catch(() => { if (activeRef.current) setAccess(null); })
      .finally(() => { if (activeRef.current) setLoading(false); });

    const onUpdated = () => refresh();
    window.addEventListener('messaging-access-updated', onUpdated);

    const sb = getSupabaseBrowser();
    const sub = sb?.auth.onAuthStateChange(() => refresh());

    return () => {
      activeRef.current = false;
      window.removeEventListener('messaging-access-updated', onUpdated);
      sub?.data.subscription.unsubscribe();
    };
  }, [refresh]);

  return { access, loading, refresh };
}
