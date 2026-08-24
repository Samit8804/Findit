import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  time: string;
  data: Record<string, any>;
}

const SELECT = 'id, type, title, body, read, data, created_at';

function mapRow(n: any): AppNotification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    time: new Date(n.created_at).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
    data: n.data || {},
  };
}

export async function getMyNotifications(): Promise<AppNotification[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data, error } = await sb
    .from('notifications')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function markNotificationRead(id: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from('notifications').update({ read: true }).eq('read', false);
}

/** Where should this notification take the user? */
export function notificationLink(n: AppNotification): string {
  switch (n.type) {
    case 'new_message':
      return n.data?.conversation_id
        ? `/dashboard/messages?c=${n.data.conversation_id}`
        : '/dashboard/messages';
    case 'ad_approved':
      return n.data?.ad_slug ? `/ad/${n.data.ad_slug}` : '/dashboard/my-ads';
    case 'ad_rejected':
      return '/dashboard/my-ads';
    case 'payment_success':
    case 'payment_failed':
      return '/dashboard/payments';
    default:
      return '/dashboard/notifications';
  }
}