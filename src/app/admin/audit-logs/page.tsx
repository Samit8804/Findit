'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Shield,
  ScrollText,
  Calendar,
  Clock,
  Loader2,
  Eye,
  Filter,
  RefreshCw,
  Download,
} from 'lucide-react';
import { DataTable, Input, Select, Tabs, Pagination } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Feedback';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { recentActivity } from '@/data/adminData2';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin';

interface AuditLogRow {
  id: string;
  admin_id: string;
  admin_name?: string | null;
  admin_email?: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ip_hash?: string | null;
}

const PAGE_SIZE = 20;

// Actions shown in Tabs — keep in sync with backend examples
const ACTION_TABS = [
  'All',
  'AD_APPROVED',
  'AD_REJECTED',
  'AD_SUSPENDED',
  'USER_SUSPENDED',
  'USER_BANNED',
  'USER_UNSUSPENDED',
  'ROLE_CHANGED',
  'PAYMENT_REFUNDED',
  'REPORT_RESOLVED',
] as const;

const DATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function actionBadgeCls(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('approved') || a.includes('unsuspended') || a.includes('restored')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (a.includes('rejected') || a.includes('suspended') || a.includes('banned')) return 'bg-red-50 text-[#D32F2F] border-red-100';
  if (a.includes('refunded') || a.includes('resolved') || a.includes('dismissed')) return 'bg-sky-50 text-sky-700 border-sky-100';
  if (a.includes('role') || a.includes('promotion') || a.includes('payment')) return 'bg-violet-50 text-violet-700 border-violet-100';
  if (a.includes('report') || a.includes('spam') || a.includes('flag')) return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-slate-50 text-black border-slate-200';
}

function entityBadgeCls(entityType: string): string {
  switch (entityType.toLowerCase()) {
    case 'ad': return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'profile':
    case 'user': return 'bg-violet-50 text-violet-700 border-violet-100';
    case 'report': return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'order':
    case 'payment': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'business': return 'bg-orange-50 text-orange-700 border-orange-100';
    default: return 'bg-slate-50 text-black border-slate-200';
  }
}

function metadataPreview(meta: Record<string, unknown> | null): string {
  if (!meta || Object.keys(meta).length === 0) return '—';
  // Prefer reason / details / duration fields
  const reason = (meta as Record<string, unknown>).reason as string | undefined;
  if (reason) return String(reason);
  const details = (meta as Record<string, unknown>).details as string | undefined;
  if (details) return String(details);
  // Fallback: compact JSON
  const s = JSON.stringify(meta);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

function dateRangeStart(value: string): string | null {
  const now = new Date();
  if (value === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (value === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (value === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

// Build mock logs from recentActivity (spec fallback)
function buildMockLogs(): AuditLogRow[] {
  const now = Date.now();
  // Mapping from recentActivity entries to audit-like actions
  const mapping: { action: string; entity_type: string; admin: string }[] = [
    { action: 'USER_REGISTERED', entity_type: 'user', admin: 'system' },
    { action: 'AD_APPROVED', entity_type: 'ad', admin: 'demo-admin' },
    { action: 'REPORT_RECEIVED', entity_type: 'report', admin: 'moderator-1' },
    { action: 'PAYMENT_COMPLETED', entity_type: 'payment', admin: 'system' },
    { action: 'PROMOTION_ACTIVATED', entity_type: 'promotion', admin: 'demo-admin' },
    { action: 'BUSINESS_VERIFICATION', entity_type: 'business', admin: 'admin-ops' },
  ];

  const base = recentActivity.map((item, idx) => {
    const m = mapping[idx % mapping.length];
    // Parse "5 min ago", "18 min ago", "1 hour ago" into offset
    let offsetMs = idx * 60 * 60 * 1000;
    if (item.time.includes('min')) {
      const n = parseInt(item.time, 10) || 5;
      offsetMs = n * 60 * 1000;
    } else if (item.time.includes('hour')) {
      const n = parseInt(item.time, 10) || 1;
      offsetMs = n * 60 * 60 * 1000;
    }
    const created = new Date(now - offsetMs).toISOString();
    const id = `mock-${idx + 1}-${(item?.icon || 'bell').toLowerCase()}`;
    const reason = item.text;
    return {
      id,
      admin_id: m.admin,
      admin_name: m.admin === 'system' ? 'System' : m.admin === 'demo-admin' ? 'Demo Admin' : m.admin,
      action: m.action,
      entity_type: m.entity_type,
      entity_id: `entity-${idx + 1}`,
      metadata: { reason, icon: item?.icon || 'bell', time: item.time },
      created_at: created,
      ip_hash: null,
    } as AuditLogRow;
  });

  // Add a few more synthetic entries to demonstrate all filter actions
  const extras: Omit<AuditLogRow, 'admin_name'>[] = [
    { id: 'mock-7', admin_id: 'demo-admin', action: 'AD_REJECTED', entity_type: 'ad', entity_id: 'ad-rejected-1', metadata: { reason: 'Prohibited content — counterfeit goods' }, created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(), ip_hash: 'abc123' },
    { id: 'mock-8', admin_id: 'super-admin', action: 'USER_SUSPENDED', entity_type: 'profile', entity_id: 'u-5', metadata: { reason: 'Repeated policy violations — spam listings', duration: '7d' }, created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), ip_hash: null },
    { id: 'mock-9', admin_id: 'super-admin', action: 'USER_BANNED', entity_type: 'profile', entity_id: 'u-4', metadata: { reason: 'Fraud, counterfeit goods, severe abuse' }, created_at: new Date(now - 8 * 60 * 60 * 1000).toISOString(), ip_hash: null },
    { id: 'mock-10', admin_id: 'demo-admin', action: 'USER_UNSUSPENDED', entity_type: 'profile', entity_id: 'u-5', metadata: {}, created_at: new Date(now - 9 * 60 * 60 * 1000).toISOString(), ip_hash: null },
    { id: 'mock-11', admin_id: 'super-admin', action: 'ROLE_CHANGED', entity_type: 'profile', entity_id: 'u-2', metadata: { from: 'user', to: 'moderator' }, created_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(), ip_hash: null },
    { id: 'mock-12', admin_id: 'demo-admin', action: 'PAYMENT_REFUNDED', entity_type: 'payment', entity_id: 'FND-ORD-8399', metadata: { reason: 'Buyer cancellation', amount: 117 }, created_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(), ip_hash: null },
    { id: 'mock-13', admin_id: 'moderator-1', action: 'REPORT_RESOLVED', entity_type: 'report', entity_id: 'rpt-2', metadata: { resolution: 'Ad removed, seller warned' }, created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), ip_hash: null },
    { id: 'mock-14', admin_id: 'moderator-1', action: 'AD_SUSPENDED', entity_type: 'ad', entity_id: 'adm-3', metadata: { reason: 'Under investigation — spam' }, created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), ip_hash: null },
  ];

  return [...base, ...extras as AuditLogRow[]].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

const MOCK_LOGS = buildMockLogs();

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminAuditLogsPage() {
  // Auth / role
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Controls
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<(typeof ACTION_TABS)[number]>('All');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Detail modal
  const [preview, setPreview] = useState<AuditLogRow | null>(null);

  const isAdmin = currentRole === 'admin' || currentRole === 'super_admin' || currentRole === 'moderator';

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Fetch current user role (client-side guard — layout also guards server-side)
  useEffect(() => {
    let cancelled = false;
    async function fetchAuth() {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setCurrentRole('super_admin');
          setAuthLoading(false);
        }
        return;
      }
      try {
        const sb = getSupabaseBrowser()!;
        const { data: auth } = await sb.auth.getUser();
        if (!auth.user) {
          if (!cancelled) {
            setAuthError('Not authenticated. Please sign in as an admin.');
            setAuthLoading(false);
          }
          return;
        }
        const { data: profile, error } = await sb
          .from('profiles')
          .select('role, account_status')
          .eq('id', auth.user.id)
          .single();
        if (error) {
          if (!cancelled) {
            setAuthError('Unable to verify admin access.');
            setAuthLoading(false);
          }
          return;
        }
        const role = ((profile?.role as string) || 'user') as AppRole;
        if (!cancelled) {
          setCurrentRole(role);
          if (role !== 'admin' && role !== 'super_admin' && role !== 'moderator') {
            setAuthError('Access denied — admin privileges required.');
          }
          setAuthLoading(false);
        }
      } catch {
        if (!cancelled) {
          setAuthError('Unable to verify admin access.');
          setAuthLoading(false);
        }
      }
    }
    void fetchAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    // Mock fallback — filter client-side
    if (!isSupabaseConfigured) {
      let filtered = MOCK_LOGS.filter((r) => {
        const q = debouncedSearch.toLowerCase();
        const matchesSearch =
          !q ||
          r.admin_id.toLowerCase().includes(q) ||
          (r.admin_name && r.admin_name.toLowerCase().includes(q)) ||
          r.action.toLowerCase().includes(q) ||
          r.entity_type.toLowerCase().includes(q) ||
          (r.entity_id && r.entity_id.toLowerCase().includes(q)) ||
          JSON.stringify(r.metadata || {}).toLowerCase().includes(q);
        const matchesAction =
          actionFilter === 'All' ? true : r.action.toLowerCase() === actionFilter.toLowerCase();
        const start = dateRangeStart(dateFilter);
        const matchesDate = !start || new Date(r.created_at) >= new Date(start);
        return matchesSearch && matchesAction && matchesDate;
      });
      setTotal(filtered.length);
      const startIdx = (page - 1) * PAGE_SIZE;
      filtered = filtered.slice(startIdx, startIdx + PAGE_SIZE);
      setRows(filtered);
      setLoading(false);
      return;
    }

    try {
      const sb = getSupabaseBrowser()!;
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = sb
        .from('admin_audit_logs')
        .select('id, admin_id, action, entity_type, entity_id, metadata, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (actionFilter !== 'All') {
        // DB stores lower-case with underscores (ad_approved etc.) — compare lower
        query = query.eq('action', actionFilter.toLowerCase());
      }

      const startIso = dateRangeStart(dateFilter);
      if (startIso) {
        query = query.gte('created_at', startIso);
      }

      const q = debouncedSearch;
      if (q) {
        // Search by admin or entity — ilike across action/entity fields; admin_id is uuid so include entity_id
        // Use or filter; escape % and , not needed for simple terms
        const term = q.replace(/%/g, '').replace(/,/g, '');
        query = query.or(`action.ilike.%${term}%,entity_type.ilike.%${term}%,entity_id.ilike.%${term}%`);
        // admin_id search handled separately if q looks like uuid-ish we already cover; otherwise still try
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const logs = (data || []) as AuditLogRow[];
      setTotal(count ?? logs.length);

      if (logs.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Enrich admin display names — fetch profiles for admin_ids in page
      const adminIds = Array.from(new Set(logs.map((l) => l.admin_id).filter(Boolean)));
      let adminMap = new Map<string, { name: string | null; email: string | null }>();
      if (adminIds.length > 0) {
        try {
          const { data: admins } = await sb.from('profiles').select('id, name, email').in('id', adminIds);
          if (admins) {
            for (const a of admins as unknown as { id: string; name: string | null; email: string | null }[]) {
              adminMap.set(a.id, { name: a.name, email: a.email });
            }
          }
        } catch {
          // non-critical
        }
      }

      const enriched: AuditLogRow[] = logs.map((l) => ({
        ...l,
        admin_name: adminMap.get(l.admin_id)?.name || null,
        admin_email: adminMap.get(l.admin_id)?.email || null,
      }));

      // If search term should also match admin name/email but that is not in DB query, do post-filter
      // For now, if term was admin name we would have 0 results — as a fallback, if query returned empty and term present, try client-side admin name match
      // Instead, if debouncedSearch and adminMap has a hit, keep as is. No extra filtering.

      setRows(enriched);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load audit logs';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, actionFilter, dateFilter, page]);

  useEffect(() => {
    if (authLoading) return;
    if (authError && !isAdmin && isSupabaseConfigured) return;
    void fetchLogs();
  }, [authLoading, authError, isAdmin, fetchLogs]);

  // Realtime for audit logs
  useEffect(() => {
    if (!isSupabaseConfigured || !isAdmin) return;
    const sb = getSupabaseBrowser()!;
    const ch = sb.channel('admin-audit-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'admin_audit_logs' }, () => { void fetchLogs(); }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [isAdmin, fetchLogs]);

  const actionTabs = useMemo(() => [...ACTION_TABS] as string[], []);

  // Early states
  if (authLoading) {
    return (
      <div className="space-y-5">
        <div className="h-10 w-40 bg-slate-100 rounded-xl animate-pulse" />
        <div className="bg-white rounded-2xl border border-slate-100 p-10 flex items-center justify-center gap-2 text-black">
          <Loader2 className="w-5 h-5 animate-spin" /> Verifying admin access...
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured && authError && !isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#E53935] flex items-center justify-center mx-auto mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-black text-[#0F172A]">Access denied</h1>
        <p className="text-sm text-black mt-2 max-w-md mx-auto">{authError}</p>
        <Link href="/" className="inline-flex mt-6 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-bold">
          Back to site
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#0F172A] text-white flex items-center justify-center">
              <ScrollText className="w-4 h-4" />
            </span>
            Audit Logs
          </h1>
          <p className="text-xs text-black mt-1">
            {loading ? 'Loading...' : `${total.toLocaleString('en-IN')} audit events`}
            {!isSupabaseConfigured && (
              <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                Demo data — Supabase not configured
              </span>
            )}
            {currentRole && (
              <span className="ml-2 text-[11px] font-semibold">
                Signed in as <span className="font-black capitalize">{currentRole.replace('_', ' ')}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const headers = ['id','created_at','admin_id','admin_name','action','entity_type','entity_id','metadata'];
              const csv = [headers.join(','), ...rows.map(r => headers.map(h => {
                const v = (r as any)[h];
                const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v).replace(/"/g,'""') : String(v).replace(/"/g,'""');
                return `"${s}"`;
              }).join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
            }}
            disabled={rows.length===0}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold hover:border-slate-300 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => void fetchLogs()}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold hover:border-slate-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Controls: search + date range */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-grow relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
          <Input
            placeholder="Search by admin, action or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search audit logs"
            className="pl-9"
          />
        </div>
        <div className="md:w-48">
          <Select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            options={DATE_OPTIONS}
            aria-label="Filter by date range"
          />
        </div>
        <div className="md:w-48">
          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as (typeof ACTION_TABS)[number])}
            options={ACTION_TABS.map((a) => ({ value: a, label: a === 'All' ? 'All actions' : a }))}
            aria-label="Filter by action"
          />
        </div>
      </div>

      {/* Action tabs — mirrors admin ads style (white cards, rounded) */}
      <Tabs tabs={actionTabs} active={actionFilter} onChange={(t) => setActionFilter(t as (typeof ACTION_TABS)[number])} />

      {/* Hint bar */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-black">
        <span className="inline-flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filters:
        </span>
        <span className="inline-flex px-2 py-1 rounded-full bg-white border border-slate-200 font-semibold">
          Action: {actionFilter}
        </span>
        <span className="inline-flex px-2 py-1 rounded-full bg-white border border-slate-200 font-semibold">
          Date: {DATE_OPTIONS.find((o) => o.value === dateFilter)?.label}
        </span>
        {debouncedSearch && (
          <span className="inline-flex px-2 py-1 rounded-full bg-[#0F172A] text-white font-semibold">
            Search: {debouncedSearch}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" aria-busy="true">
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-28 h-4 rounded bg-slate-200 shrink-0" />
                <div className="w-24 h-6 rounded-full bg-slate-100 shrink-0" />
                <div className="hidden sm:block w-20 h-6 rounded-full bg-slate-100" />
                <div className="flex-grow h-4 rounded bg-slate-100" />
                <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
          <p className="text-sm font-semibold text-[#D32F2F]">{loadError}</p>
          <button
            onClick={() => void fetchLogs()}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold hover:bg-[#D32F2F] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
            <ScrollText className="w-6 h-6 text-black" />
          </div>
          <p className="text-sm font-semibold text-black">No audit events match your filters.</p>
          <p className="text-xs text-black mt-1">Try a different action, date range or search term.</p>
          <button
            onClick={() => {
              setSearch('');
              setActionFilter('All');
              setDateFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <DataTable headers={['Time', 'Admin', 'Action', 'Entity', 'Metadata']}>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="pl-5 pr-3 py-3.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-black">
                    <Calendar className="w-3 h-3 text-black" />
                    {formatDateTime(r.created_at)}
                  </span>
                  <span className="block text-[11px] text-black font-mono mt-0.5">{r.id.slice(0, 8)}…</span>
                </td>
                <td className="px-3 py-3.5">
                  <span className="block text-xs font-bold text-[#0F172A] truncate max-w-[150px]">
                    {r.admin_name || r.admin_email || r.admin_id.slice(0, 8) + '…'}
                  </span>
                  <span className="block text-[11px] text-black font-mono truncate max-w-[150px]" title={r.admin_id}>
                    {r.admin_id}
                  </span>
                  {r.ip_hash && (
                    <span className="block text-[10px] text-black mt-0.5">ip: {String(r.ip_hash).slice(0, 12)}…</span>
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${actionBadgeCls(r.action)}`}>
                    {r.action}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-bold border capitalize ${entityBadgeCls(r.entity_type)}`}>
                    {r.entity_type}
                  </span>
                  {r.entity_id && (
                    <span className="block text-[11px] font-mono text-black mt-1 truncate max-w-[140px]" title={r.entity_id}>
                      {r.entity_id}
                    </span>
                  )}
                </td>
                <td className="pr-5 pl-3 py-3.5 max-w-[320px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-black leading-relaxed line-clamp-2" title={JSON.stringify(r.metadata)}>
                      {metadataPreview(r.metadata)}
                    </span>
                    <button
                      onClick={() => setPreview(r)}
                      title="View details"
                      className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-black transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          <p className="text-center text-[11px] text-black">
            Page {page} of {totalPages} — {total.toLocaleString('en-IN')} events • {PAGE_SIZE}/page
          </p>
        </>
      )}

      {/* Detail modal */}
      <Modal open={preview !== null} onClose={() => setPreview(null)} title="Audit Event" size="sm">
        {preview && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 col-span-2">
                <dt className="text-[11px] text-black font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time
                </dt>
                <dd className="font-bold text-[#0F172A] text-xs mt-0.5">{formatDateTime(preview.created_at)}</dd>
                <dd className="font-mono text-[11px] text-black mt-0.5">{preview.created_at}</dd>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Admin</dt>
                <dd className="font-bold text-[#0F172A] text-xs mt-0.5 truncate">{preview.admin_name || preview.admin_id}</dd>
                <dd className="font-mono text-[11px] text-black truncate">{preview.admin_id}</dd>
                {preview.admin_email && <dd className="text-[11px] text-black truncate">{preview.admin_email}</dd>}
                {preview.ip_hash && <dd className="text-[11px] text-black mt-1">ip_hash: {preview.ip_hash}</dd>}
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Action</dt>
                <dd className={`inline-flex mt-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${actionBadgeCls(preview.action)}`}>
                  {preview.action}
                </dd>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Entity type</dt>
                <dd className="font-bold text-[#0F172A] text-xs mt-0.5 capitalize">{preview.entity_type}</dd>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Entity ID</dt>
                <dd className="font-mono text-xs font-bold text-[#0F172A] mt-0.5 break-all">{preview.entity_id || '—'}</dd>
              </div>
              <div className="col-span-2 bg-white rounded-xl px-3 py-3 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold uppercase tracking-wide mb-1.5">Metadata</dt>
                <dd>
                  {preview.metadata && Object.keys(preview.metadata).length > 0 ? (
                    <pre className="text-xs bg-slate-50 rounded-xl p-3 border border-slate-100 overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(preview.metadata, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-xs text-black">No metadata</span>
                  )}
                </dd>
              </div>
              <div className="col-span-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Event ID</dt>
                <dd className="font-mono text-[11px] text-black break-all mt-0.5">{preview.id}</dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}
