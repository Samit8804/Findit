import { getSupabaseBrowser } from '@/lib/supabase/client';

export type Plan = 'free' | 'business' | 'business-pro';

export interface MyProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  plan: Plan;
  role: 'user' | 'admin';
}

export async function getMyProfile(): Promise<MyProfile | null> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    // Demo mode: pretend to be a paying user so nothing is blocked
    return { id: 'demo', name: 'Demo User', plan: 'business', role: 'admin' };
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data } = await sb
    .from('profiles')
    .select('id, name, display_name, avatar_url, plan, role')
    .eq('id', auth.user.id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    name: data.display_name || data.name || '',
    avatarUrl: data.avatar_url || undefined,
    plan: (data.plan as Plan) || 'free',
    role: (data.role as MyProfile['role']) || 'user',
  };
}