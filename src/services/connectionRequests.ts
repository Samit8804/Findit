import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

export interface ConnectionRequest {
  id: string;
  senderId: string;
  recipientId: string;
  listingId: string;
  initialMessage: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  // Joined fields (optional, populated by queries with joins)
  listingTitle?: string;
  senderName?: string;
  senderAvatar?: string;
}

/* ------------------------------------------------------------------ */
/* CLIENT-SIDE SERVICE (browser Supabase client)                      */
/* ------------------------------------------------------------------ */

export async function sendConnectionRequest(
  listingId: string,
  recipientId: string,
  initialMessage: string
): Promise<ConnectionRequest> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');

  const trimmed = initialMessage.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > 500) throw new Error('Maximum 500 characters.');

  const { data, error } = await sb
    .from('connection_requests')
    .insert({
      sender_id: auth.user.id,
      recipient_id: recipientId,
      listing_id: listingId,
      initial_message: trimmed,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapConnectionRequest(data);
}

export async function listConnectionRequests({
  role,
  status,
}: { role: 'sender' | 'recipient'; status?: string }): Promise<ConnectionRequest[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  let q = sb
    .from('connection_requests')
    .select(`
      *,
      ads(title),
      sender:profiles!connection_requests_sender_id_fkey(id, name),
      recipient:profiles!connection_requests_recipient_id_fkey(id, name)
    `)
    .order('created_at', { ascending: false });

  if (role === 'sender') {
    q = q.eq('sender_id', auth.user.id);
  } else {
    q = q.eq('recipient_id', auth.user.id);
  }

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data || []).map((r: any) => ({
    id: r.id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    listingId: r.listing_id,
    initialMessage: r.initial_message,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    respondedAt: r.responded_at,
    listingTitle: r.ads?.title,
    senderName: r.sender?.name,
    recipientName: r.recipient?.name,
  }));
}

export async function respondToConnectionRequest(
  requestId: string,
  response: 'accept' | 'decline'
): Promise<ConnectionRequest> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');

  const newStatus = response === 'accept' ? 'accepted' : 'declined';

  const { data, error } = await sb
    .from('connection_requests')
    .update({ status: newStatus })
    .eq('id', requestId)
    .eq('recipient_id', auth.user.id)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapConnectionRequest(data);
}

export async function cancelConnectionRequest(requestId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');

  const { error } = await sb
    .from('connection_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('sender_id', auth.user.id)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
}

function mapConnectionRequest(row: any): ConnectionRequest {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    listingId: row.listing_id,
    initialMessage: row.initial_message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at,
  };
}

/* ------------------------------------------------------------------ */
/* SERVER-SIDE ENTITLEMENT CHECK (call via Supabase RPC or API route) */
/* ------------------------------------------------------------------ */

/**
 * Check if a user has an active messaging subscription.
 * This calls the database RPC `has_active_messaging_subscription`.
 * Must be called server-side (or via a trusted API route) — never trust
 * client-supplied plan names or subscription status.
 */
export async function hasActiveMessagingSubscription(userId: string): Promise<boolean> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    // Demo mode: no backend, assume unlocked for development
    return true;
  }

  const { data, error } = await sb.rpc('has_active_messaging_subscription', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[messagingEntitlement] RPC failed:', error.message);
    return false;
  }

  return Boolean(data);
}
