import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      if (!getSupabaseBrowser()) {
        setLoading(false);
        return;
      }

      const sb = getSupabaseBrowser()!;
      const { data: { user }, error } = await sb.auth.getUser();

      if (error) {
        console.error('Auth error:', error);
        setUser(null);
      } else {
        setUser(user);
      }
      setLoading(false);
    }

    fetchUser();
  }, []);

  return { user, loading };
}