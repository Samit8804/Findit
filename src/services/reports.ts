import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Report statuses that require admin/moderator attention.
 * Based on the report workflow in admin/reports/page.tsx:
 * - 'open': newly submitted, not yet reviewed
 * - 'investigating': assigned to a moderator, being reviewed
 * - 'resolved': action taken, violation found
 * - 'dismissed': reviewed, no violation found
 * Only 'open' and 'investigating' require active attention.
 */
export type PendingReportStatus = 'open' | 'investigating';

export interface PendingReportsCount {
  count: number;
  byStatus: Record<string, number>;
}

/**
 * Fetch the count of reports that require admin attention.
 * Returns counts for 'open' and 'investigating' statuses.
 */
export async function getPendingReportsCount(): Promise<PendingReportsCount> {
  if (!isSupabaseConfigured) {
    // Return mock data for development when Supabase is not configured
    return { count: 5, byStatus: { open: 3, investigating: 2 } };
  }

  const sb = getSupabaseBrowser()!;

  try {
    const { data, error } = await sb
      .from('reports')
      .select('status')
      .in('status', ['open', 'investigating']);

    if (error) throw error;

    const rows = (data || []) as { status: string }[];
    const byStatus: Record<string, number> = { open: 0, investigating: 0 };

    for (const row of rows) {
      if (row.status === 'open' || row.status === 'investigating') {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      }
    }

    const count = byStatus.open + byStatus.investigating;

    return { count, byStatus };
  } catch (err) {
    console.error('Failed to fetch pending reports count:', err);
    return { count: 0, byStatus: { open: 0, investigating: 0 } };
  }
}

/**
 * Subscribe to real-time changes in the reports table to keep the pending count updated.
 * Call the returned unsubscribe function to clean up when the component unmounts.
 */
export function subscribeToPendingReportsCount(
  onCountChange: (count: PendingReportsCount) => void
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const sb = getSupabaseBrowser()!;

  // Initial fetch
  getPendingReportsCount().then(onCountChange);

  // Subscribe to real-time changes on the reports table
  const channel = sb
    .channel('admin-reports-count')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reports',
        filter: 'status=in.(open,investigating,resolved,dismissed)',
      },
      async () => {
        // Re-fetch count on any change to reports with relevant statuses
        const count = await getPendingReportsCount();
        onCountChange(count);
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    sb.removeChannel(channel);
  };
}

/**
 * Format the count for display in the badge.
 * Returns null if count is 0 (badge should be hidden).
 */
export function formatPendingReportsCount(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return '99+';
  return String(count);
}