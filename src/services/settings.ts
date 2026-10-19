import { getSupabaseBrowser } from '@/lib/supabase/client';

export interface UserSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  showPhoneOnAds: boolean;
  whatsappContact: boolean;
  marketingEmails: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  emailNotifications: true,
  pushNotifications: true,
  showPhoneOnAds: false,
  whatsappContact: true,
  marketingEmails: false,
};

const BOOLEAN_KEYS: (keyof UserSettings)[] = [
  'emailNotifications',
  'pushNotifications',
  'showPhoneOnAds',
  'whatsappContact',
  'marketingEmails',
];

function mergeSettings(raw: unknown): UserSettings {
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of BOOLEAN_KEYS) {
    if (typeof stored[key] === 'boolean') merged[key] = stored[key];
  }
  return merged;
}

export async function getMySettings(): Promise<UserSettings | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return DEFAULT_SETTINGS; // demo mode
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('preferences')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) {
    // Server not migrated yet (0051): keep the page usable with defaults.
    if (error.code === '42703' || error.code === 'PGRST204' || error.message.includes('preferences')) {
      console.warn('profiles.preferences is unavailable; using default settings.');
      return DEFAULT_SETTINGS;
    }
    throw new Error(error.message);
  }
  return mergeSettings(data?.preferences);
}

export async function saveMySettings(settings: UserSettings): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return; // demo mode: caller persists locally
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');
  const { error } = await sb
    .from('profiles')
    .update({ preferences: mergeSettings(settings) })
    .eq('id', auth.user.id);
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204' || error.message.includes('preferences')) {
      throw new Error('MISSING_PREFERENCES_COLUMN');
    }
    throw new Error(error.message);
  }
}
