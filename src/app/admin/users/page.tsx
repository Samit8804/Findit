'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  Ban,
  ShieldCheck,
  Shield,
  UserCog,
  Clock,
  Flag,
  Search,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { adminUsers, AdminUser } from '@/data/adminData';
import { DataTable, Input, Select, Tabs as FilterTabs, Pagination } from '@/components/ui/Form';
import { Modal, ConfirmDialog, useToast } from '@/components/ui/Feedback';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type AccountStatus = 'active' | 'suspended' | 'banned';
type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin';
type FilterValue = 'All' | 'Active' | 'Suspended' | 'Banned' | 'Verified' | 'Unverified';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  account_status: AccountStatus;
  is_verified: boolean;
  created_at: string;
  updated_at?: string | null;
  suspension_reason?: string | null;
  suspended_until?: string | null;
  adsCount: number;
  reportsCount: number;
  lastActivity: string | null;
}

const PAGE_SIZE = 20;

const statusCls: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  suspended: 'bg-amber-50 text-amber-700 border-amber-100',
  banned: 'bg-red-50 text-[#D32F2F] border-red-100',
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Suspended: 'bg-amber-50 text-amber-700 border-amber-100',
  Banned: 'bg-red-50 text-[#D32F2F] border-red-100',
};

const roleCls: Record<string, string> = {
  user: 'bg-slate-50 text-black border-slate-200',
  moderator: 'bg-violet-50 text-violet-700 border-violet-100',
  admin: 'bg-blue-50 text-blue-700 border-blue-100',
  super_admin: 'bg-[#0F172A] text-white border-[#0F172A]',
};

const DURATION_OPTIONS: { value: string; label: string; ms: number | null }[] = [
  { value: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '3d', label: '3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: '30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'permanent', label: 'Permanent', ms: null },
];

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso as string;
  }
}

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
    return iso as string;
  }
}

function suspensionLabel(row: UserRow): string {
  if (row.account_status !== 'suspended') return '—';
  if (!row.suspended_until) return 'Permanent';
  return `Until ${formatDateTime(row.suspended_until)}`;
}

// Convert mock AdminUser → UserRow
function mockToRow(u: AdminUser): UserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: 'user',
    account_status: u.status.toLowerCase() as AccountStatus,
    is_verified: u.verified,
    created_at: u.joinedAt,
    updated_at: null,
    suspension_reason: null,
    suspended_until: null,
    adsCount: u.totalAds,
    reportsCount: Math.floor(Math.random() * 4),
    lastActivity: u.joinedAt,
  };
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminUsersPage() {
  const toast = useToast();

  // Auth / role
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Controls
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('All');
  const [page, setPage] = useState(1);

  // Modals
  const [preview, setPreview] = useState<UserRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendDuration, setSuspendDuration] = useState('7d');
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [banReason, setBanReason] = useState('');
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState<AppRole>('user');
  const [confirmUnsuspend, setConfirmUnsuspend] = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isSuperAdmin = currentRole === 'super_admin';
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
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Fetch current user role
  useEffect(() => {
    let cancelled = false;
    async function fetchAuth() {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setCurrentRole('super_admin');
          setCurrentUserId('demo-admin');
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
        if (!cancelled) setCurrentUserId(auth.user.id);
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
        const role = (profile?.role as AppRole) || 'user';
        if (!cancelled) {
          setCurrentRole(role);
          // still allow page but gate actions; flag if not admin
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    // Mock fallback
    if (!isSupabaseConfigured) {
      const all = adminUsers.map(mockToRow);
      let filtered = all.filter((u) => {
        const q = debouncedSearch.toLowerCase();
        const matchesSearch =
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q);
        const matchesFilter =
          filter === 'All'
            ? true
            : filter === 'Active'
              ? u.account_status === 'active'
              : filter === 'Suspended'
                ? u.account_status === 'suspended'
                : filter === 'Banned'
                  ? u.account_status === 'banned'
                  : filter === 'Verified'
                    ? u.is_verified
                    : filter === 'Unverified'
                      ? !u.is_verified
                      : true;
        return matchesSearch && matchesFilter;
      });
      setTotal(filtered.length);
      const start = (page - 1) * PAGE_SIZE;
      filtered = filtered.slice(start, start + PAGE_SIZE);
      setRows(filtered);
      setLoading(false);
      return;
    }

    try {
      const sb = getSupabaseBrowser()!;
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = sb
        .from('profiles')
        .select(
          'id, name, email, role, account_status, is_verified, created_at, updated_at, suspension_reason, suspended_until',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(from, to);

      const q = debouncedSearch;
      if (q) {
        // Search by name / email / user ID
        // id is uuid — use exact match when q looks uuid-ish else ilike
        const isUuid = /^[0-9a-f-]{8,}$/i.test(q);
        if (isUuid && q.length > 7) {
          query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,id.eq.${q}`);
        } else {
          query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
        }
      }

      if (filter === 'Active' || filter === 'Suspended' || filter === 'Banned') {
        query = query.eq('account_status', filter.toLowerCase());
      } else if (filter === 'Verified') {
        query = query.eq('is_verified', true);
      } else if (filter === 'Unverified') {
        query = query.eq('is_verified', false);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const profiles = (data || []) as unknown as UserRow[];
      setTotal(count ?? 0);

      if (profiles.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const ids = profiles.map((p) => p.id);

      // Ads count per user (non-deleted only)
      let adsCountMap = new Map<string, number>();
      try {
        const { data: adsRows } = await sb
          .from('ads')
          .select('user_id')
          .in('user_id', ids)
          .is('deleted_at', null);
        if (adsRows) {
          for (const r of adsRows as unknown as { user_id: string }[]) {
            adsCountMap.set(r.user_id, (adsCountMap.get(r.user_id) || 0) + 1);
          }
        }
      } catch {
        // non-critical
      }

      // Reports count per user (reported_user_id)
      let reportsCountMap = new Map<string, number>();
      try {
        const { data: repRows } = await sb
          .from('reports')
          .select('reported_user_id')
          .in('reported_user_id', ids);
        if (repRows) {
          for (const r of repRows as unknown as { reported_user_id: string | null }[]) {
            if (!r.reported_user_id) continue;
            reportsCountMap.set(r.reported_user_id, (reportsCountMap.get(r.reported_user_id) || 0) + 1);
          }
        }
      } catch {
        // table may not exist in older envs
      }

      const merged: UserRow[] = profiles.map((p) => ({
        id: p.id,
        name: (p.name as string) || 'Unnamed',
        email: (p.email as string) || '—',
        role: ((p.role as string) || 'user') as AppRole,
        account_status: ((p.account_status as string) || 'active') as AccountStatus,
        is_verified: !!p.is_verified,
        created_at: p.created_at,
        updated_at: (p as unknown as { updated_at?: string | null }).updated_at ?? null,
        suspension_reason: (p.suspension_reason as string | null) ?? null,
        suspended_until: (p.suspended_until as string | null) ?? null,
        adsCount: adsCountMap.get(p.id) || 0,
        reportsCount: reportsCountMap.get(p.id) || 0,
        lastActivity: (p as unknown as { updated_at?: string | null }).updated_at || p.created_at,
      }));

      setRows(merged);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load users';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, page]);

  useEffect(() => {
    if (authLoading) return;
    if (authError && !isAdmin && isSupabaseConfigured) return;
    void fetchUsers();
  }, [authLoading, authError, isAdmin, fetchUsers]);

  // Keep preview in sync after list refresh
  useEffect(() => {
    if (preview) {
      const updated = rows.find((r) => r.id === preview.id);
      if (updated) setPreview(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Actions helpers
  const insertAuditAndNotify = useCallback(
    async (
      sb: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
      target: UserRow,
      action: string,
      metadata: Record<string, unknown>,
      notif: { type: string; title: string; body?: string | null }
    ) => {
      if (!currentUserId) return;
      try {
        await sb.from('admin_audit_logs').insert({
          admin_id: currentUserId,
          action,
          entity_type: 'profile',
          entity_id: target.id,
          metadata,
        });
      } catch {
        // ignore audit failure but continue
      }
      try {
        // Prefer RPC if available
        const { error: rpcErr } = await sb.rpc('notify_user', {
          p_user: target.id,
          p_type: notif.type,
          p_title: notif.title,
          p_body: notif.body ?? null,
        });
        if (rpcErr) throw rpcErr;
      } catch {
        try {
          await sb.from('notifications').insert({
            user_id: target.id,
            type: notif.type,
            title: notif.title,
            body: notif.body ?? null,
          } as never);
        } catch {
          // ignore
        }
      }
    },
    [currentUserId]
  );

  const doSuspend = useCallback(async () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim()) {
      toast('Suspension reason is required.');
      return;
    }
    if (!isSupabaseConfigured) {
      // mock branch
      setRows((prev) =>
        prev.map((r) =>
          r.id === suspendTarget.id
            ? {
                ...r,
                account_status: 'suspended' as AccountStatus,
                suspension_reason: suspendReason.trim(),
                suspended_until:
                  suspendDuration === 'permanent' ? null : new Date(Date.now() + (DURATION_OPTIONS.find((d) => d.value === suspendDuration)?.ms || 0)).toISOString(),
              }
            : r
        )
      );
      if (preview?.id === suspendTarget.id) {
        setPreview((p) =>
          p
            ? {
                ...p,
                account_status: 'suspended',
                suspension_reason: suspendReason.trim(),
                suspended_until:
                  suspendDuration === 'permanent' ? null : new Date(Date.now() + (DURATION_OPTIONS.find((d) => d.value === suspendDuration)?.ms || 0)).toISOString(),
              }
            : p
        );
      }
      toast(`${suspendTarget.name} suspended (${suspendDuration === 'permanent' ? 'permanent' : suspendDuration}).`);
      setSuspendTarget(null);
      setSuspendReason('');
      return;
    }
    setActionLoading(true);
    try {
      const sb = getSupabaseBrowser()!;
      const opt = DURATION_OPTIONS.find((d) => d.value === suspendDuration);
      const suspendedUntil = opt?.ms == null ? null : new Date(Date.now() + opt.ms).toISOString();
      const { error } = await sb
        .from('profiles')
        .update({
          account_status: 'suspended',
          suspension_reason: suspendReason.trim(),
          suspended_until: suspendedUntil,
        } as never)
        .eq('id', suspendTarget.id);
      if (error) throw error;

      await insertAuditAndNotify(sb, suspendTarget, 'user_suspended', { reason: suspendReason.trim(), duration: suspendDuration, suspended_until: suspendedUntil }, {
        type: 'account_suspended',
        title: `Your account has been suspended${suspendedUntil ? ` until ${formatDateTime(suspendedUntil)}` : ' permanently'}.`,
        body: `Reason: ${suspendReason.trim()}`,
      });

      toast(`${suspendTarget.name} suspended.`);
      setSuspendTarget(null);
      setSuspendReason('');
      void fetchUsers();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to suspend user.');
    } finally {
      setActionLoading(false);
    }
  }, [suspendTarget, suspendReason, suspendDuration, insertAuditAndNotify, toast, fetchUsers, preview]);

  const doBan = useCallback(async () => {
    if (!banTarget) return;
    if (!banReason.trim()) {
      toast('Ban reason is required.');
      return;
    }
    if (!isSupabaseConfigured) {
      setRows((prev) => prev.map((r) => (r.id === banTarget.id ? { ...r, account_status: 'banned' as AccountStatus, suspension_reason: banReason.trim(), suspended_until: null } : r)));
      toast(`${banTarget.name} banned.`);
      setBanTarget(null);
      setBanReason('');
      return;
    }
    setActionLoading(true);
    try {
      const sb = getSupabaseBrowser()!;
      const { error } = await sb
        .from('profiles')
        .update({ account_status: 'banned', suspension_reason: banReason.trim(), suspended_until: null } as never)
        .eq('id', banTarget.id);
      if (error) throw error;
      await insertAuditAndNotify(sb, banTarget, 'user_banned', { reason: banReason.trim() }, {
        type: 'account_banned',
        title: 'Your account has been banned.',
        body: `Reason: ${banReason.trim()}`,
      });
      toast(`${banTarget.name} banned.`);
      setBanTarget(null);
      setBanReason('');
      void fetchUsers();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to ban user.');
    } finally {
      setActionLoading(false);
    }
  }, [banTarget, banReason, insertAuditAndNotify, toast, fetchUsers]);

  const doUnsuspend = useCallback(
    async (target: UserRow) => {
      if (!isSupabaseConfigured) {
        setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, account_status: 'active' as AccountStatus, suspension_reason: null, suspended_until: null } : r)));
        toast(`${target.name} unsuspended.`);
        setConfirmUnsuspend(null);
        return;
      }
      setActionLoading(true);
      try {
        const sb = getSupabaseBrowser()!;
        const { error } = await sb
          .from('profiles')
          .update({ account_status: 'active', suspension_reason: null, suspended_until: null } as never)
          .eq('id', target.id);
        if (error) throw error;
        await insertAuditAndNotify(sb, target, 'user_unsuspended', {}, {
          type: 'account_restored',
          title: 'Your account has been restored.',
          body: 'You can now sign in and use FindIt again.',
        });
        toast(`${target.name} unsuspended.`);
        setConfirmUnsuspend(null);
        void fetchUsers();
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : 'Failed to unsuspend user.');
      } finally {
        setActionLoading(false);
      }
    },
    [insertAuditAndNotify, toast, fetchUsers]
  );

  const doChangeRole = useCallback(async () => {
    if (!roleTarget) return;
    if (!isSuperAdmin) {
      toast('Only super admins can change roles.');
      return;
    }
    if (!isSupabaseConfigured) {
      setRows((prev) => prev.map((r) => (r.id === roleTarget.id ? { ...r, role: newRole } : r)));
      toast(`Role updated to ${newRole} for ${roleTarget.name} (demo).`);
      setRoleTarget(null);
      return;
    }
    setActionLoading(true);
    try {
      const sb = getSupabaseBrowser()!;
      const { error } = await sb.from('profiles').update({ role: newRole } as never).eq('id', roleTarget.id);
      if (error) throw error;
      await insertAuditAndNotify(sb, roleTarget, 'role_changed', { from: roleTarget.role, to: newRole }, {
        type: 'role_changed',
        title: `Your role has been updated to ${newRole}.`,
        body: null,
      });
      toast(`Role changed to ${newRole}.`);
      setRoleTarget(null);
      void fetchUsers();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to update role.');
    } finally {
      setActionLoading(false);
    }
  }, [roleTarget, newRole, isSuperAdmin, insertAuditAndNotify, toast, fetchUsers]);

  const filterTabs = useMemo(() => ['All', 'Active', 'Suspended', 'Banned', 'Verified', 'Unverified'] as FilterValue[], []);

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
          <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">Users</h1>
          <p className="text-xs text-black mt-1">
            {loading ? 'Loading...' : `${total.toLocaleString('en-IN')} registered accounts`}
            {!isSupabaseConfigured && <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">Demo data — Supabase not configured</span>}
            {currentRole && (
              <span className="ml-2 text-[11px] font-semibold">
                Signed in as <span className="font-black capitalize">{currentRole.replace('_', ' ')}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-black">
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Suspended
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Banned
          </span>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-grow relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
          <Input
            placeholder="Search by name, email or user ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
            className="pl-9"
          />
        </div>
        <div className="md:w-52">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterValue)}
            options={[
              { value: 'All', label: 'All statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Suspended', label: 'Suspended' },
              { value: 'Banned', label: 'Banned' },
              { value: 'Verified', label: 'Verified' },
              { value: 'Unverified', label: 'Unverified' },
            ]}
            aria-label="Filter by status"
          />
        </div>
      </div>

      <FilterTabs tabs={filterTabs as unknown as string[]} active={filter} onChange={(t) => setFilter(t as FilterValue)} />

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" aria-busy="true">
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0" />
                <div className="flex-grow space-y-2">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-48 rounded bg-slate-100" />
                </div>
                <div className="hidden sm:block w-20 h-6 rounded-full bg-slate-100" />
                <div className="hidden md:block w-16 h-4 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
          <p className="text-sm font-semibold text-[#D32F2F]">{loadError}</p>
          <button onClick={() => void fetchUsers()} className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold hover:bg-[#D32F2F] transition-colors">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6 text-black" />
          </div>
          <p className="text-sm font-semibold text-black">No users match your filters.</p>
          <p className="text-xs text-black mt-1">Try a different search or filter.</p>
          <button
            onClick={() => {
              setSearch('');
              setFilter('All');
            }}
            className="mt-4 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <DataTable
            headers={['User', 'Email', 'Role', 'Account status', 'Join date', 'Ads', 'Reports', 'Last activity', 'Actions']}
          >
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="pl-5 pr-3 py-3.5">
                  <button onClick={() => setPreview(u)} className="flex items-center gap-3 text-left group">
                    <span className="w-9 h-9 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center text-xs font-black shrink-0 border border-red-100">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 max-w-[160px]">
                      <span className="block font-bold group-hover:text-[#E53935] transition-colors truncate text-[#0F172A]">{u.name}</span>
                      <span className="block text-[11px] text-black truncate font-mono">{u.id.slice(0, 8)}…</span>
                    </span>
                  </button>
                </td>
                <td className="px-3 py-3.5 max-w-[180px]">
                  <span className="block text-xs text-black truncate" title={u.email}>
                    {u.email}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${roleCls[u.role] || roleCls.user}`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCls[u.account_status]}`}>
                    {u.account_status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : u.account_status === 'suspended' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span className="capitalize">{u.account_status}</span>
                  </span>
                  {u.account_status === 'suspended' && u.suspended_until && (
                    <span className="block text-[10px] text-amber-600 mt-1 whitespace-nowrap">{suspensionLabel(u)}</span>
                  )}
                </td>
                <td className="px-3 py-3.5 text-black whitespace-nowrap text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-black" />
                    {formatDate(u.created_at)}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <Link href={`/admin/ads?user=${u.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-black hover:text-[#E53935] transition-colors" title="Review ads">
                    <FileText className="w-3.5 h-3.5" />
                    {u.adsCount}
                  </Link>
                </td>
                <td className="px-3 py-3.5">
                  <Link href={`/admin/reports?user=${u.id}`} className={`inline-flex items-center gap-1 text-xs font-bold transition-colors ${u.reportsCount > 0 ? 'text-amber-600 hover:text-amber-700' : 'text-black'}`} title="Review reports">
                    <Flag className="w-3.5 h-3.5" />
                    {u.reportsCount}
                  </Link>
                </td>
                <td className="px-3 py-3.5 text-black whitespace-nowrap text-xs">{formatDate(u.lastActivity)}</td>
                <td className="pr-5 pl-3 py-3.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPreview(u)} title="View profile preview" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-black transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    {u.is_verified ? (
                      <span title="Verified" className="p-2 text-emerald-500">
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                    ) : (
                      <span title="Unverified" className="p-2 text-black">
                        <Shield className="w-4 h-4" />
                      </span>
                    )}
                    {u.account_status === 'active' && (
                      <>
                        <button
                          onClick={() => {
                            setSuspendReason('');
                            setSuspendDuration('7d');
                            setSuspendTarget(u);
                          }}
                          title="Suspend (with reason + duration)"
                          className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-700 text-black transition-colors"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setBanReason(''); setBanTarget(u); }} title="Ban (requires reason)" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-black transition-colors">
                          <Ban className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {(u.account_status === 'suspended' || u.account_status === 'banned') && (
                      <button onClick={() => setConfirmUnsuspend(u)} title="Unsuspend" className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-black transition-colors">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {isSuperAdmin ? (
                      <button
                        onClick={() => {
                          setNewRole(u.role);
                          setRoleTarget(u);
                        }}
                        title="Change role (super_admin only)"
                        className="p-2 rounded-lg hover:bg-[#0F172A] hover:text-white text-black transition-colors"
                      >
                        <UserCog className="w-4 h-4" />
                      </button>
                    ) : (
                      <span title="Only super_admin can change roles" className="p-2 text-slate-200 cursor-not-allowed">
                        <UserCog className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          <p className="text-center text-[11px] text-black">
            Page {page} of {totalPages} — {total.toLocaleString('en-IN')} users • {PAGE_SIZE}/page
          </p>
        </>
      )}

      {/* Profile preview modal */}
      <Modal open={preview !== null} onClose={() => setPreview(null)} title="User Profile Preview" size="sm">
        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 rounded-2xl bg-[#E53935] text-white font-black text-2xl flex items-center justify-center shrink-0">
                {preview.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-black text-[#0F172A] truncate">{preview.name}</p>
                <p className="text-xs text-black truncate">{preview.email}</p>
                <p className="text-[11px] font-mono text-black truncate mt-0.5">{preview.id}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${statusCls[preview.account_status]}`}>
                {preview.account_status}
              </span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${roleCls[preview.role]}`}>
                {preview.role.replace('_', ' ')}
              </span>
              {preview.is_verified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-black border border-slate-200">Unverified</span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Join date</dt>
                <dd className="font-bold text-[#0F172A] text-xs mt-0.5">{formatDate(preview.created_at)}</dd>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Last activity</dt>
                <dd className="font-bold text-[#0F172A] text-xs mt-0.5">{formatDate(preview.lastActivity)}</dd>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Advertisements</dt>
                <dd className="font-black text-[#0F172A]">{preview.adsCount}</dd>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                <dt className="text-[11px] text-black font-semibold">Reports</dt>
                <dd className="font-black text-[#0F172A]">{preview.reportsCount}</dd>
              </div>
              {preview.account_status === 'suspended' && (
                <>
                  <div className="col-span-2 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                    <dt className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Suspension reason
                    </dt>
                    <dd className="font-semibold text-amber-900 text-xs mt-0.5">{preview.suspension_reason || '—'}</dd>
                  </div>
                  <div className="col-span-2 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                    <dt className="text-[11px] text-amber-700 font-semibold">Suspended until</dt>
                    <dd className="font-semibold text-amber-900 text-xs mt-0.5">{suspensionLabel(preview)}</dd>
                  </div>
                </>
              )}
              {preview.account_status === 'banned' && preview.suspension_reason && (
                <div className="col-span-2 bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
                  <dt className="text-[11px] text-[#D32F2F] font-semibold">Ban reason</dt>
                  <dd className="font-semibold text-red-900 text-xs mt-0.5">{preview.suspension_reason}</dd>
                </div>
              )}
            </dl>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link href={`/admin/ads?user=${preview.id}`} className="py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-bold text-center hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Review ads
              </Link>
              <Link href={`/admin/reports?user=${preview.id}`} className="py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-center hover:border-slate-300 transition-colors flex items-center justify-center gap-1.5">
                <Flag className="w-3.5 h-3.5" /> Review reports
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {preview.account_status === 'active' ? (
                <>
                  <button
                    onClick={() => {
                      setSuspendReason('');
                      setSuspendDuration('7d');
                      setSuspendTarget(preview);
                    }}
                    className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
                  >
                    Suspend
                  </button>
                  <button onClick={() => { setBanReason(''); setBanTarget(preview); }} className="py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold transition-colors">
                    Ban
                  </button>
                  <button
                    disabled={!isSuperAdmin}
                    onClick={() => {
                      setNewRole(preview.role);
                      setRoleTarget(preview);
                    }}
                    className="py-2.5 rounded-xl border border-slate-200 text-xs font-bold hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Change role
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setConfirmUnsuspend(preview)} className="col-span-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors">
                    Unsuspend
                  </button>
                  <button
                    disabled={!isSuperAdmin}
                    onClick={() => {
                      setNewRole(preview.role);
                      setRoleTarget(preview);
                    }}
                    className="py-2.5 rounded-xl border border-slate-200 text-xs font-bold hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Change role
                  </button>
                </>
              )}
            </div>
            {!isSuperAdmin && <p className="text-[11px] text-black text-center">Role changes require super_admin privileges.</p>}
          </div>
        )}
      </Modal>

      {/* Suspend modal — reason + duration */}
      <Modal open={suspendTarget !== null} onClose={() => !actionLoading && setSuspendTarget(null)} title="Suspend user" size="sm">
        {suspendTarget && (
          <div className="space-y-4">
            <p className="text-sm text-black">
              Suspend <span className="font-bold text-[#0F172A]">{suspendTarget.name}</span> — they will be logged out and notified. This is recorded in the audit log.
            </p>
            <Input
              label="Reason (required)"
              placeholder="e.g. Repeated policy violations — spam listings"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              hint="Shown to the user and stored as suspension_reason."
            />
            <Select
              label="Duration"
              value={suspendDuration}
              onChange={(e) => setSuspendDuration(e.target.value)}
              options={DURATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            {suspendDuration !== 'permanent' && (
              <p className="text-[11px] text-black flex items-center gap-1">
                <Clock className="w-3 h-3" /> Will set suspended_until to {formatDateTime(new Date(Date.now() + (DURATION_OPTIONS.find((d) => d.value === suspendDuration)?.ms || 0)).toISOString())}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setSuspendTarget(null)} disabled={actionLoading} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={() => void doSuspend()}
                disabled={actionLoading || !suspendReason.trim()}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Suspend
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ban modal — reason required */}
      <Modal open={banTarget !== null} onClose={() => !actionLoading && setBanTarget(null)} title="Ban user" size="sm">
        {banTarget && (
          <div className="space-y-4">
            <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertTriangle className="w-4 h-4 text-[#D32F2F] shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 leading-relaxed">
                Banning <span className="font-bold">{banTarget.name}</span> is permanent until manually unsuspended. The user will be notified and this action is audit-logged.
              </p>
            </div>
            <Input
              label="Ban reason (required)"
              placeholder="e.g. Fraud, counterfeit goods, severe abuse"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              hint="Stored as suspension_reason with account_status=banned and suspended_until=null."
            />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setBanTarget(null)} disabled={actionLoading} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={() => void doBan()}
                disabled={actionLoading || !banReason.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Ban user
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Change role — super_admin only */}
      <Modal open={roleTarget !== null} onClose={() => !actionLoading && setRoleTarget(null)} title="Change role" size="sm">
        {roleTarget && (
          <div className="space-y-4">
            {!isSuperAdmin ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <Shield className="w-6 h-6 text-black mx-auto mb-2" />
                <p className="text-sm font-semibold text-black">Only super_admin can change roles.</p>
                <p className="text-xs text-black mt-1">Your current role is {currentRole}. Ask a super_admin to perform this change.</p>
                <button onClick={() => setRoleTarget(null)} className="mt-4 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold">Close</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-black">
                  Update role for <span className="font-bold text-[#0F172A]">{roleTarget.name}</span> ({roleTarget.email})
                </p>
                <p className="text-[11px] font-mono text-black">{roleTarget.id}</p>
                <Select
                  label="New role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AppRole)}
                  options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setRoleTarget(null)} disabled={actionLoading} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40">
                    Cancel
                  </button>
                  <button
                    onClick={() => void doChangeRole()}
                    disabled={actionLoading || newRole === roleTarget.role}
                    className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-bold transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Confirm change
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmUnsuspend !== null}
        onClose={() => setConfirmUnsuspend(null)}
        onConfirm={() => confirmUnsuspend && void doUnsuspend(confirmUnsuspend)}
        title="Unsuspend user?"
        message={`${confirmUnsuspend?.name} will be restored to active and notified. suspended_until and suspension_reason will be cleared.`}
        confirmLabel={actionLoading ? 'Restoring...' : 'Unsuspend'}
        danger={false}
      />
    </div>
  );
}
