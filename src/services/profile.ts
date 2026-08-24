import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

export type Plan = 'free' | 'business' | 'business-pro';

export interface MyProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  plan: Plan;
}

/** Messaging is a paid feature: free plan cannot access it. */
export function canUseMessaging(plan: Plan): boolean {
  return plan !== 'free';
}

export async function getMyProfile(): Promise<MyProfile | null> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    // Demo mode: pretend to be a paying user so nothing is blocked
    return { id: 'demo', name: 'Demo User', plan: 'business' };
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data } = await sb
    .from('profiles')
    .select('id, name, avatar_url, plan')
    .eq('id', auth.user.id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name || '',
    avatarUrl: data.avatar_url || undefined,
    plan: (data.plan as Plan) || 'free',
  };
}