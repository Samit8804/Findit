import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ConversationSummary {
  id: string;
  adId: string;
  adTitle: string;
  adImage: string;
  adPrice: number | null;
  adStatus: string | null;
  adSlug: string | null;
  role: 'buyer' | 'seller';
  otherName: string;
  otherAvatar?: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  mine: boolean;
  message: string;
  time: string;
  isRead: boolean;
}

const SELECT_CONV = `
  id, ad_id, buyer_id, seller_id, updated_at,
  ads(title, price, status, slug, ad_images(image_url, is_primary)),
  buyer:profiles!conversations_buyer_id_fkey(id, name, avatar_url),
  seller:profiles!conversations_seller_id_fkey(id, name, avatar_url)`;

function mapConversation(row: any, myId: string): ConversationSummary {
  const iAmBuyer = row.buyer_id === myId;
  const other = iAmBuyer ? row.seller : row.buyer;
  const msgs = row.messages || [];
  const last = msgs[0];
  return {
    id: row.id,
    adId: row.ad_id,
    adTitle: row.ads?.title ?? '',
    adImage:
      (row.ads?.ad_images || []).find((i: any) => i.is_primary)?.image_url || '',
    adPrice: row.ads?.price != null ? Number(row.ads.price) : null,
    adStatus: row.ads?.status ?? null,
    adSlug: row.ads?.slug ?? null,
    role: iAmBuyer ? 'buyer' : 'seller',
    otherName: other?.name || 'User',
    otherAvatar: other?.avatar_url || undefined,
    lastMessage: last?.message ?? '',
    lastTime: last ? timeAgo(last.created_at) : timeAgo(row.updated_at),
    unread: msgs.filter((m: any) => !m.is_read && m.sender_id !== myId).length,
  };
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ------------------------------------------------------------------ */
/* CONVERSATIONS                                                       */
/* ------------------------------------------------------------------ */

export async function listConversations(): Promise<ConversationSummary[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await sb
    .from('conversations')
    .select(
      `${SELECT_CONV},
       messages(message, created_at, is_read, sender_id)`
    )
    .or(`buyer_id.eq.${auth.user.id},seller_id.eq.${auth.user.id}`)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => mapConversation(r, auth.user!.id));
}

/** Create-or-get a conversation for this buyer/seller/ad pair. Returns id. */
export async function openOrCreateConversation(
  adId: string,
  sellerId: string
): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');
  const me = auth.user.id;

  if (me === sellerId) throw new Error('SELF_CONVERSATION');

  // Existing?
  const { data: existing } = await sb
    .from('conversations')
    .select('id')
    .eq('ad_id', adId)
    .eq('buyer_id', me)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (existing) return existing.id;

  // Blocked either way?
  const { data: blocked } = await sb
    .from('blocked_users')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${me},blocked_id.eq.${sellerId}),and(blocker_id.eq.${sellerId},blocked_id.eq.${me})`);
  if (blocked && blocked.length > 0) throw new Error('USER_BLOCKED');

  const { data, error } = await sb
    .from('conversations')
    .insert({ ad_id: adId, buyer_id: me, seller_id: sellerId })
    .select('id')
    .single();
  if (error) {
    // Unique violation → someone else created it concurrently; fetch it
    if (error.code === '23505') {
      const { data: conv } = await sb
        .from('conversations')
        .select('id')
        .eq('ad_id', adId)
        .eq('buyer_id', me)
        .eq('seller_id', sellerId)
        .single();
      if (conv) return conv.id;
    }
    throw new Error(error.message);
  }
  return data.id;
}

/* ------------------------------------------------------------------ */
/* MESSAGES                                                            */
/* ------------------------------------------------------------------ */

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data: auth } = await sb.auth.getUser();
  const me = auth.user?.id;
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((m: any) => ({
    id: m.id,
    senderId: m.sender_id,
    mine: m.sender_id === me,
    message: m.message,
    time: new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    isRead: m.is_read,
  }));
}

export async function sendMessage(conversationId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > 2000) throw new Error('Maximum 2000 characters.');
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');
  const { error } = await sb.from('messages').insert({
    conversation_id: conversationId,
    sender_id: auth.user.id, // enforced server-side by trigger anyway
    message: trimmed,
  });
  if (error) throw new Error(error.message);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  await sb
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', auth.user.id)
    .eq('is_read', false);
}

export async function getUnreadCounts(): Promise<{ messages: number; notifications: number }> {
  const sb = getSupabaseBrowser();
  if (!sb) return { messages: 0, notifications: 0 };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { messages: 0, notifications: 0 };

  const [convRes, notifRes] = await Promise.all([
    sb.from('conversations').select('id').or(`buyer_id.eq.${auth.user.id},seller_id.eq.${auth.user.id}`),
    sb.from('notifications').select('id').eq('user_id', auth.user.id).eq('read', false),
  ]);

  let unreadMessages = 0;
  if (convRes.data && convRes.data.length > 0) {
    const ids = convRes.data.map((c: any) => c.id);
    const { count } = await sb
      .from('messages')
      .select('id', { count: 'exact', head: false })
      .in('conversation_id', ids)
      .neq('sender_id', auth.user.id)
      .eq('is_read', false);
    unreadMessages = count ?? 0;
  }

  return { messages: unreadMessages, notifications: notifRes.count ?? notifRes.data?.length ?? 0 };
}

/* ------------------------------------------------------------------ */
/* REALTIME — subscribe only while a conversation view is active       */
/* ------------------------------------------------------------------ */

export function subscribeToConversation(
  conversationId: string,
  onUpdate: () => void
): () => void {
  const sb = getSupabaseBrowser();
  if (!sb) return () => {};
  const channel: RealtimeChannel = sb
    .channel(`conv:${conversationId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      onUpdate
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

export function subscribeToMyConversations(userId: string, onUpdate: () => void): () => void {
  const sb = getSupabaseBrowser();
  if (!sb) return () => {};
  const channel = sb
    .channel(`my-convos:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversations' },
      (payload: any) => {
        const r = payload.new ?? payload.old;
        if (r && (r.buyer_id === userId || r.seller_id === userId)) onUpdate();
      }
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ */
/* BLOCK / REPORT                                                      */
/* ------------------------------------------------------------------ */

export async function blockUser(userId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  const { error } = await sb.from('blocked_users').insert({ blocker_id: (await sb.auth.getUser()).data.user!.id, blocked_id: userId });
  if (error) throw new Error(error.message);
}

export async function reportMessage(messageId: string | null, reason: string, description?: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');
  const { error } = await sb.from('message_reports').insert({
    message_id: messageId,
    reporter_id: auth.user.id,
    reason,
    description: description ?? null,
  });
  if (error) throw new Error(error.message);
}