import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/connection-requests/respond
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { request_id, action }  (action: 'accept' | 'decline')
 *
 * Only the recipient can respond. Only pending requests can be transitioned.
 * Notifies the sender via the database trigger.
 */
export async function POST(req: Request) {
  try {
    if (!isAdminConfigured) {
      return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });
    }
    const admin = getSupabaseAdmin()!;

    const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    const { data: authData } = await admin.auth.getUser(token);
    if (!authData?.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    const recipientId = authData.user.id;

    const body = await req.json().catch(() => null);
    const requestId: string | undefined = body?.request_id;
    const action: 'accept' | 'decline' | undefined = body?.action;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }
    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
    }

    // Fetch the request to verify ownership and status
    const { data: cr } = await admin
      .from('connection_requests')
      .select('id, recipient_id, status, sender_id, listing_id')
      .eq('id', requestId)
      .single();
    if (!cr) return NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404 });
    if (cr.recipient_id !== recipientId) {
      return NextResponse.json({ error: 'NOT_RECIPIENT' }, { status: 403 });
    }
    if (cr.status !== 'pending') {
      return NextResponse.json({ error: 'NOT_PENDING' }, { status: 409 });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    const { data: updated, error } = await admin
      .from('connection_requests')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('recipient_id', recipientId)
      .eq('status', 'pending')
      .select('id, status, responded_at, sender_id, listing_id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      respondedAt: updated.responded_at,
      senderId: updated.sender_id,
      listingId: updated.listing_id,
      action,
    });
  } catch (e: any) {
    console.error('[connection-requests/respond] error:', e.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
