export type AdStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'expired' | 'sold' | 'deleted' | 'changes_requested' | 'suspended' | 'reported';

/** Centralized status → color mapping per spec */
export const STATUS_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', hex: '#F59E0B' },
  changes_requested: { bg: 'bg-amber-50', text: 'text-amber-700', hex: '#F59E0B' },
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', hex: '#6B7280' },
  expired: { bg: 'bg-slate-100', text: 'text-slate-600', hex: '#6B7280' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', hex: '#10B981' },
  sold: { bg: 'bg-emerald-50', text: 'text-emerald-700', hex: '#10B981' },
  rejected: { bg: 'bg-red-50', text: 'text-[#D32F2F]', hex: '#EF4444' },
  suspended: { bg: 'bg-red-50', text: 'text-[#D32F2F]', hex: '#EF4444' },
  reported: { bg: 'bg-violet-50', text: 'text-violet-700', hex: '#8B5CF6' },
  deleted: { bg: 'bg-slate-100', text: 'text-slate-600', hex: '#6B7280' },
};

export function statusBadgeCls(status: string): string {
  const key = status.toLowerCase();
  const entry = STATUS_COLORS[key];
  if (entry) return `${entry.bg} ${entry.text} border ${entry.bg.replace('bg-', 'border-').replace('-50', '-100')}`;
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function statusHex(status: string): string {
  return STATUS_COLORS[status.toLowerCase()]?.hex ?? '#6B7280';
}

export const ALL_STATUSES: AdStatus[] = ['pending','changes_requested','approved','rejected','reported','expired','sold','draft','suspended'];
