import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/connection-requests/list?role=sender|recipient&status=pending|accepted|declined|cancelled
 * Headers: Authorization: Bearer <supabase-access-token>
 *
 * Returns connection requests for the authenticated user.
 */
export async function GET(req: Request) {
  try {
    if (!isAdminConfigured) {
      return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });
    }
    const admin = getSupabaseAdmin()!;

    const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    const { data: authData } = await admin.auth.getUser(token);
    if (!authData?.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    const userId = authData.user.id;

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || 'recipient';
    const status = searchParams.get('status');

    if (!['sender', 'recipient'].includes(role)) {
      return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 400 });
    }

    let q = admin
      .from('connection_requests')
      .select(`
        id, sender_id, recipient_id, listing_id, initial_message,
        status, created_at, updated_at, responded_at,
        ads(title),
        sender:profiles!connection_requests_sender_id_fkey(id, name, avatar_url),
        recipient:profiles!connection_requests_recipient_id_fkey(id, name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (role === 'sender') {
      q = q.eq('sender_id', userId);
    } else {
      q = q.eq('recipient_id', userId);
    }

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const requests = (data || []).map((r: any) => ({
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
      senderAvatar: r.sender?.avatar_url,
      recipientName: r.recipient?.name,
    }));

    return NextResponse.json({ requests });
  } catch (e: any) {
    console.error('[connection-requests/list] error:', e.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
