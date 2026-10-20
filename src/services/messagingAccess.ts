import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { MessagingAccess } from '@/lib/messagingEntitlement';

const DENIED: MessagingAccess = {
  allowed: false,
  isAdmin: false,
  planName: null,
  expiresAt: null,
  reason: 'NO_ACTIVE_PLAN',
  configured: true,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return asRecord(value[0]);
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function normalizeAccess(value: unknown, configured: boolean): MessagingAccess {
  const row = asRecord(value);
  if (!row) return { ...DENIED, configured };
  return {
    allowed: row.allowed === true,
    isAdmin: row.isAdmin === true,
    planName: typeof row.planName === 'string' ? row.planName : null,
    expiresAt: typeof row.expiresAt === 'string' ? row.expiresAt : null,
    reason: typeof row.reason === 'string' ? row.reason : 'NO_ACTIVE_PLAN',
    configured,
  };
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function|function .* does not exist/i.test(error.message ?? '')
  );
}

/** Server-derived entitlement for the signed-in user. Never accepts a user id. */
export async function getMyMessagingAccess(): Promise<MessagingAccess> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    return {
      allowed: true,
      isAdmin: false,
      planName: 'Demo preview',
      expiresAt: null,
      reason: 'DEMO_MODE',
      configured: false,
    };
  }

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return { ...DENIED, reason: 'NOT_AUTHENTICATED' };
  }

  const { data, error } = await sb.rpc('get_my_messaging_access');
  if (!error) return normalizeAccess(data, true);

  // Graceful fallback while migration 0052 has not been applied yet.
  if (isMissingFunction(error)) {
    const { data: legacy, error: legacyError } = await sb.rpc(
      'has_active_messaging_subscription',
      { p_user_id: auth.user.id }
    );
    if (!legacyError) {
      return {
        allowed: legacy === true,
        isAdmin: false,
        planName: legacy === true ? 'Active plan' : null,
        expiresAt: null,
        reason: legacy === true ? 'LEGACY_ACTIVE_PLAN' : 'NO_ACTIVE_PLAN',
        configured: true,
      };
    }
  }

  console.error('[messagingAccess] entitlement check failed:', error.message);
  return { ...DENIED, reason: 'UNAVAILABLE' };
}

export function notifyMessagingAccessUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('messaging-access-updated'));
  }
}
