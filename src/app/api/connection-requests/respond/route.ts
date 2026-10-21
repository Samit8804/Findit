import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin';
import { getSupabaseUserClient } from '@/lib/supabase/user';

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
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const requestId: string | undefined = body?.request_id;
    const action: 'accept' | 'decline' | undefined = body?.action;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }
    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
    }

    const userClient = getSupabaseUserClient(token);
    if (!userClient) return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });

    const { data: result, error } = await userClient.rpc('respond_to_connection_request', {
      p_request_id: requestId,
      p_action: action,
    });

    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : error.code === '40001' ? 409 : 500;
      if (status === 500) console.error('[connection-requests/respond] response failed:', error.message);
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('[connection-requests/respond] error:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
