import { getSupabaseBrowser } from '@/lib/supabase/client';

export interface ConnectionRequest {
  id: string;
  senderId: string;
  recipientId: string;
  listingId: string | null;
  initialMessage: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  // Joined fields (optional, populated by queries with joins)
  listingTitle?: string;
  senderName?: string;
  senderAvatar?: string;
  /** Returned by respond_to_connection_request when a request is accepted. */
  conversationId?: string | null;
}

export interface SearchUserResult {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  location: string | null;
  accountType: string;
  connectionStatus: 'none' | 'sent' | 'incoming' | 'connected';
  requestId?: string;
}

/* ------------------------------------------------------------------ */
/* CLIENT-SIDE SERVICE (browser Supabase client)                      */
/* ------------------------------------------------------------------ */

export async function searchUsersByUsername(query: string): Promise<SearchUserResult[]> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');

  const token = (await sb.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'USER_SEARCH_FAILED');
  return body.users as SearchUserResult[];
}

export async function sendDirectConnectionRequest(recipientId: string): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');

  const { data, error } = await sb.rpc('send_direct_connection_request', {
    p_recipient_id: recipientId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

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

  // The RPC is atomic: it locks the request, checks that the caller is the
  // recipient, accepts/declines it, and (on accept) creates/returns the
  // pair's direct conversation.
  const { data, error } = await sb.rpc('respond_to_connection_request', {
    p_request_id: requestId,
    p_action: response,
  });
  if (error) throw new Error(error.message);

  const row = data as {
    id: string;
    senderId: string;
    recipientId: string;
    listingId: string | null;
    initialMessage: string;
    status: ConnectionRequest['status'];
    createdAt: string;
    updatedAt: string;
    respondedAt: string | null;
    conversationId?: string | null;
  };

  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    listingId: row.listingId ?? null,
    initialMessage: row.initialMessage ?? '',
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    respondedAt: row.respondedAt ?? null,
    conversationId: row.conversationId ?? null,
  };
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
