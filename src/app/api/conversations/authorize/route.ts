import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/conversations/authorize
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { buyer_id, seller_id, listing_id }
 *
 * Server-side authorization check before creating a conversation.
 * Verifies: accepted connection request, active messaging subscription,
 * no blocks, correct participants, valid listing.
 *
 * Returns { allowed: boolean, reason?: string }
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
    const callerId = authData.user.id;

    const body = await req.json().catch(() => null);
    const buyerId: string | undefined = body?.buyer_id;
    const sellerId: string | undefined = body?.seller_id;
    const listingId: string | undefined = body?.listing_id;

    if (!buyerId || !sellerId || !listingId) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }

    // Caller must be the buyer or the seller
    if (callerId !== buyerId && callerId !== sellerId) {
      return NextResponse.json({ error: 'NOT_PARTICIPANT' }, { status: 403 });
    }

    // Use the database RPC for comprehensive server-side check
    const { data: result, error } = await admin.rpc('can_start_conversation', {
      p_buyer_id: buyerId,
      p_seller_id: sellerId,
      p_listing_id: listingId,
    });

    if (error) {
      return NextResponse.json({ allowed: false, reason: error.message }, { status: 403 });
    }

    return NextResponse.json(result as { allowed: boolean; reason?: string });
  } catch (e: any) {
    console.error('[conversations/authorize] error:', e.message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
