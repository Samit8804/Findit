import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/connection-requests/send
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { listing_id, recipient_id, initial_message }
 *
 * Server verifies: authentication, recipient owns listing, no blocks,
 * no duplicate active requests. Insert via service-role so RLS doesn't
 * block the insert (we validate ownership server-side).
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
    const senderId = authData.user.id;

    const body = await req.json().catch(() => null);
    const listingId: string | undefined = body?.listing_id;
    const recipientId: string | undefined = body?.recipient_id;
    const initialMessage: string | undefined = body?.initial_message;

    if (!listingId || !recipientId || !initialMessage) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }
    const trimmed = initialMessage.trim();
    if (!trimmed) return NextResponse.json({ error: 'EMPTY_MESSAGE' }, { status: 400 });
    if (trimmed.length > 500) return NextResponse.json({ error: 'MESSAGE_TOO_LONG' }, { status: 400 });

    // Validate listing exists and recipient owns it
    const { data: ad } = await admin
      .from('ads')
      .select('id, user_id, title')
      .eq('id', listingId)
      .single();
    if (!ad) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 });
    if (ad.user_id !== recipientId) {
      return NextResponse.json({ error: 'RECIPIENT_NOT_OWNER' }, { status: 403 });
    }

    // No self-requests
    if (senderId === recipientId) {
      return NextResponse.json({ error: 'SELF_REQUEST' }, { status: 403 });
    }

    // Blocked-user check
    const { data: blocked } = await admin
      .from('blocked_users')
      .select('blocker_id')
      .or(
        `and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId})`
      );
    if (blocked && blocked.length > 0) {
      return NextResponse.json({ error: 'USERS_BLOCKED' }, { status: 403 });
    }

    // No duplicate active requests
    const { data: existing } = await admin
      .from('connection_requests')
      .select('id')
      .eq('sender_id', senderId)
      .eq('recipient_id', recipientId)
      .eq('listing_id', listingId)
      .in('status', ['pending', 'accepted']);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'DUPLICATE_REQUEST' }, { status: 409 });
    }

    // Insert via service role (validated above)
    const { data: cr, error } = await admin
      .from('connection_requests')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        listing_id: listingId,
        initial_message: trimmed,
        status: 'pending',
      })
      .select('id, sender_id, recipient_id, listing_id, initial_message, status, created_at')
      .single();

    if (error) {
      // Unique violation → duplicate request created concurrently
      if (error.code === '23505') {
        return NextResponse.json({ error: 'DUPLICATE_REQUEST' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: cr.id,
      senderId: cr.sender_id,
      recipientId: cr.recipient_id,
      listingId: cr.listing_id,
      initialMessage: cr.initial_message,
      status: cr.status,
      createdAt: cr.created_at,
    });
  } catch (e: any) {
    console.error('[connection-requests/send] error:', e.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
