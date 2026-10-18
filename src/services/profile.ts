import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

export type Plan = 'free' | 'business' | 'business-pro';

export interface MyProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  plan: Plan;
  role: 'user' | 'admin';
}

/** Sync quick check based on profile.plan. Admins always allowed. */
export function canUseMessaging(profile: MyProfile): boolean {
  if (profile.role === 'admin') return true;
  return profile.plan !== 'free';
}

/** Async server-verified check: queries user_subscriptions for an active,
 * non-expired subscription. This is the single source of truth for messaging
 * entitlement. Returns true in demo mode (no backend configured). */
export async function hasActiveMessagingSubscription(userId: string): Promise<boolean> {
  const sb = getSupabaseBrowser();
  if (!sb) return true; // demo mode
  const { data, error } = await sb.rpc('has_active_messaging_subscription', {
    p_user_id: userId,
  });
  if (error) return false;
  return Boolean(data);
}

/** Combined check: profile.plan is non-free AND an active subscription exists.
 * Use this for UI gating; server-side authorization is enforced separately. */
export async function canUseMessagingVerified(profile: MyProfile): Promise<boolean> {
  if (profile.role === 'admin') return true;
  if (profile.plan === 'free') return false;
  return hasActiveMessagingSubscription(profile.id);
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
    .select('id, name, avatar_url, plan, role')
    .eq('id', auth.user.id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name || '',
    avatarUrl: data.avatar_url || undefined,
    plan: (data.plan as Plan) || 'free',
    role: (data.role as MyProfile['role']) || 'user',
  };
}