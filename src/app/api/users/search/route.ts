import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';
import { getSupabaseUserClient } from '@/lib/supabase/user';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!isAdminConfigured) {
      return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });
    }

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

    const admin = getSupabaseAdmin()!;
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
    }

    const query = new URL(req.url).searchParams.get('q')?.trim().replace(/^@/, '').toLowerCase() || '';
    if (query.length < 2 || query.length > 30 || !/^[a-z0-9-]+$/.test(query)) {
      return NextResponse.json({ users: [] });
    }

    const userClient = getSupabaseUserClient(token);
    if (!userClient) return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });

    const { data: users, error: searchError } = await userClient.rpc('search_public_users', {
      p_query: query,
      p_limit: 10,
    });
    if (searchError) {
      console.error('[users/search] search failed:', searchError.message);
      return NextResponse.json({ error: 'USER_SEARCH_FAILED' }, { status: 500 });
    }

    if (!users?.length) return NextResponse.json({ users: [] });

    const userIds = users.map((user: { id: string }) => user.id);
    const [outgoing, incoming] = await Promise.all([
      admin
        .from('connection_requests')
        .select('id, recipient_id, status')
        .eq('sender_id', authData.user.id)
        .in('recipient_id', userIds)
        .in('status', ['pending', 'accepted']),
      admin
        .from('connection_requests')
        .select('id, sender_id, status')
        .eq('recipient_id', authData.user.id)
        .in('sender_id', userIds)
        .in('status', ['pending', 'accepted']),
    ]);

    if (outgoing.error || incoming.error) {
      console.error('[users/search] request status lookup failed:', outgoing.error?.message || incoming.error?.message);
      return NextResponse.json({ error: 'USER_SEARCH_FAILED' }, { status: 500 });
    }

    const outgoingByUser = new Map((outgoing.data || []).map((request) => [request.recipient_id, request]));
    const incomingByUser = new Map((incoming.data || []).map((request) => [request.sender_id, request]));

    return NextResponse.json({
      users: users.map((user: {
        id: string;
        username: string;
        display_name: string | null;
        name: string | null;
        avatar_url: string | null;
        location_text: string | null;
        account_type: string;
      }) => {
        const out = outgoingByUser.get(user.id);
        const inc = incomingByUser.get(user.id);
        const request = out?.status === 'accepted' ? out : inc?.status === 'accepted' ? inc : out || inc;
        const connectionStatus = request?.status === 'accepted'
          ? 'connected'
          : out?.status === 'pending'
            ? 'sent'
            : inc?.status === 'pending'
              ? 'incoming'
              : 'none';

        return {
          id: user.id,
          username: user.username,
          displayName: user.display_name || user.name,
          avatarUrl: user.avatar_url,
          location: user.location_text,
          accountType: user.account_type,
          connectionStatus,
          requestId: connectionStatus === 'incoming' ? inc?.id : undefined,
        };
      }),
    });
  } catch (error: unknown) {
    console.error('[users/search] error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
