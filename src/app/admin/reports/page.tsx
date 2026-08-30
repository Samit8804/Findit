'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  Search,
  Flag,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Shield,
  Calendar,
  FileText,
  MessageSquare,
  User,
  ChevronRight,
  History,
  Layers,
  ShoppingBag,
} from 'lucide-react';
import { adminReports } from '@/data/adminData';
import { DataTable, Tabs as FilterTabs, Pagination, Input, Select } from '@/components/ui/Form';
import { Modal, ConfirmDialog, useToast } from '@/components/ui/Feedback';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type ReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
type ReportType = 'ad' | 'user' | 'message' | 'unknown';
type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin';

interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string | null;
  reported_user_name: string | null;
  ad_id: string | null;
  ad_title: string | null;
  message_id: string | null;
  message_snippet: string | null;
  reason: string;
  description: string | null;
  status: ReportStatus;
  priority: ReportPriority;
  assigned_to: string | null;
  assigned_to_name: string | null;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface ModeratorOption {
  id: string;
  name: string;
}

interface InvestigationDetails {
  ad: { id: string; title: string; price: number | null; status: string; description: string; sellerName: string; category: string; location: string; created_at: string } | null;
  reportedUser: { id: string; name: string; email: string; role: string; account_status: string; is_verified: boolean; created_at: string; accountAge: string } | null;
  reporterUser: { id: string; name: string; email: string; created_at: string } | null;
  message: { id: string; message: string; sender_id: string; conversation_id: string; created_at: string } | null;
  relatedConversations: { id: string; ad_id: string | null; ad_title: string | null; buyer_name: string; seller_name: string; updated_at: string }[];
  previousReports: ReportRow[];
  moderationHistory: { id: string; action: string; created_at: string; metadata: unknown }[];
  otherAds: { id: string; title: string; price: number | null; status: string; created_at: string }[];
  loading: boolean;
}

const PAGE_SIZE = 20;

const priorityOrder: Record<ReportPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_TABS: string[] = ['All', 'open', 'investigating', 'resolved', 'dismissed'];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'All', label: 'All priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'All', label: 'All types' },
  { value: 'ad', label: 'Ad' },
  { value: 'user', label: 'User' },
  { value: 'message', label: 'Message' },
];

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const PRIORITY_EDIT_OPTIONS: { value: ReportPriority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const priorityCls: Record<ReportPriority, string> = {
  critical: 'bg-red-50 text-[#B91C1C] border-red-100',
  high: 'bg-orange-50 text-orange-700 border-orange-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  low: 'bg-slate-100 text-black border-slate-200',
};

const statusCls: Record<ReportStatus, string> = {
  open: 'bg-slate-50 text-black border-slate-200',
  investigating: 'bg-blue-50 text-blue-700 border-blue-100',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  dismissed: 'bg-slate-100 text-black border-slate-200',
};

const typeCls: Record<ReportType, string> = {
  ad: 'bg-violet-50 text-violet-700 border-violet-100',
  user: 'bg-sky-50 text-sky-700 border-sky-100',
  message: 'bg-teal-50 text-teal-700 border-teal-100',
  unknown: 'bg-slate-100 text-black border-slate-200',
};

const reasonCls: Record<string, string> = {
  Spam: 'bg-orange-50 text-orange-700',
  Scam: 'bg-red-50 text-[#D32F2F]',
  Fake: 'bg-rose-50 text-rose-700',
  Duplicate: 'bg-sky-50 text-sky-700',
  'Wrong Category': 'bg-violet-50 text-violet-700',
  'Prohibited Content': 'bg-red-50 text-[#B91C1C]',
  Other: 'bg-slate-100 text-black',
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(iso);
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(iso);
  }
}

function accountAge(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''}`;
}

function getReportType(r: ReportRow): ReportType {
  if (r.ad_id) return 'ad';
  if (r.message_id) return 'message';
  if (r.reported_user_id) return 'user';
  return 'unknown';
}

function getTargetLabel(r: ReportRow): string {
  const t = getReportType(r);
  if (t === 'ad') return r.ad_title || r.ad_id || '—';
  if (t === 'user') return r.reported_user_name || r.reported_user_id || '—';
  if (t === 'message') return r.message_snippet ? `"${truncate(r.message_snippet, 64)}"` : r.message_id || '—';
  return r.description ? truncate(r.description, 48) : '—';
}

function truncate(s: string, n = 48): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function mockReports(): ReportRow[] {
  const priorities: ReportPriority[] = ['critical', 'high', 'medium', 'low', 'medium'];
  const statuses: ReportStatus[] = ['open', 'open', 'investigating', 'resolved', 'dismissed'];
  return adminReports.map((r, i) => {
    const isUserReport = r.reason === 'Wrong Category' || r.reason === 'Prohibited Content';
    return {
      id: r.id,
      reporter_id: `demo-reporter-${i + 1}`,
      reporter_name: r.reporter,
      reported_user_id: isUserReport ? `demo-user-${i + 1}` : null,
      reported_user_name: isUserReport ? `Reported User ${i + 1}` : null,
      ad_id: !isUserReport ? `demo-ad-${i + 1}` : null,
      ad_title: !isUserReport ? r.adTitle : null,
      message_id: null,
      message_snippet: null,
      reason: r.reason,
      description: r.details,
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      assigned_to: i % 3 === 0 ? 'demo-mod-1' : null,
      assigned_to_name: i % 3 === 0 ? 'Alex Moderator' : null,
      resolution: statuses[i % statuses.length] === 'resolved' ? 'Reviewed and action taken.' : statuses[i % statuses.length] === 'dismissed' ? 'No violation found.' : null,
      created_at: new Date(Date.now() - i * 86400000 * 2).toISOString(),
      resolved_at: statuses[i % statuses.length] === 'resolved' || statuses[i % statuses.length] === 'dismissed' ? new Date(Date.now() - i * 86400000).toISOString() : null,
    };
  });
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminReportsPage() {
  const toast = useToast();

  // auth
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // data
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // controls
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [page, setPage] = useState(1);

  // investigation
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationDetails | null>(null);

  // moderators for assign
  const [moderators, setModerators] = useState<ModeratorOption[]>([]);

  // inline edit state inside modal
  const [editStatus, setEditStatus] = useState<ReportStatus>('open');
  const [editPriority, setEditPriority] = useState<ReportPriority>('medium');
  const [editAssignee, setEditAssignee] = useState<string>('');
  const [editResolution, setEditResolution] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState<ReportRow | null>(null);
  const [confirmResolve, setConfirmResolve] = useState<ReportRow | null>(null);

  const isMod = currentRole === 'moderator' || currentRole === 'admin' || currentRole === 'super_admin';

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, typeFilter]);

  // fetch auth role
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
        const { data: profile, error } = await sb.from('profiles').select('role, account_status').eq('id', auth.user.id).single();
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
          if (!['moderator', 'admin', 'super_admin'].includes(role)) {
            setAuthError('Access denied — moderator privileges required.');
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

  // sync edit fields when selected changes
  useEffect(() => {
    if (selected) {
      setEditStatus(selected.status);
      setEditPriority(selected.priority);
      setEditAssignee(selected.assigned_to || '');
      setEditResolution(selected.resolution || '');
    }
  }, [selected]);

  // keep selected in sync after rows refresh
  useEffect(() => {
    if (selected) {
      const updated = rows.find((r) => r.id === selected.id);
      if (updated) setSelected(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const fetchModerators = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUserId) return;
    try {
      const sb = getSupabaseBrowser()!;
      const { data } = await sb.from('profiles').select('id, name').in('role', ['moderator', 'admin', 'super_admin']).limit(60);
      if (data) {
        setModerators((data as unknown as { id: string; name: string | null }[]).map((p) => ({ id: p.id, name: p.name || p.id.slice(0, 8) })));
      }
    } catch {
      // ignore
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!authLoading && isMod) void fetchModerators();
  }, [authLoading, isMod, fetchModerators]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    if (!isSupabaseConfigured) {
      const mocked = mockReports();
      // sort critical→high→medium→low then newest
      mocked.sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 99;
        const pb = priorityOrder[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setRows(mocked);
      setLoading(false);
      return;
    }
    try {
      const sb = getSupabaseBrowser()!;
      const { data, error } = await sb
        .from('reports')
        .select('id, reporter_id, reported_user_id, ad_id, message_id, reason, description, status, priority, assigned_to, resolution, created_at, resolved_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const raw = (data || []) as unknown as ReportRow[];
      if (raw.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      // Batch fetch names for reporter / reported / assignee / ad / message
      const reporterIds = [...new Set(raw.map((r) => r.reporter_id).filter(Boolean))] as string[];
      const reportedIds = [...new Set(raw.map((r) => r.reported_user_id).filter(Boolean))] as string[];
      const assigneeIds = [...new Set(raw.map((r) => r.assigned_to).filter(Boolean))] as string[];
      const adIds = [...new Set(raw.map((r) => r.ad_id).filter(Boolean))] as string[];
      const messageIds = [...new Set(raw.map((r) => r.message_id).filter(Boolean))] as string[];

      const profileIds = [...new Set([...reporterIds, ...reportedIds, ...assigneeIds])];

      let profileMap = new Map<string, string>();
      if (profileIds.length > 0) {
        try {
          const { data: profiles } = await sb.from('profiles').select('id, name').in('id', profileIds);
          if (profiles) {
            for (const p of profiles as unknown as { id: string; name: string | null }[]) {
              profileMap.set(p.id, p.name || p.id.slice(0, 8));
            }
          }
        } catch {
          // ignore
        }
      }

      let adMap = new Map<string, string>();
      if (adIds.length > 0) {
        try {
          const { data: ads } = await sb.from('ads').select('id, title').in('id', adIds);
          if (ads) {
            for (const a of ads as unknown as { id: string; title: string }[]) adMap.set(a.id, a.title);
          }
        } catch {
          // ignore
        }
      }

      let msgMap = new Map<string, string>();
      if (messageIds.length > 0) {
        try {
          const { data: msgs } = await sb.from('messages').select('id, message').in('id', messageIds);
          if (msgs) {
            for (const m of msgs as unknown as { id: string; message: string }[]) msgMap.set(m.id, m.message);
          }
        } catch {
          // ignore (moderator may not have msg read policy for single fetch)
        }
      }

      const enriched: ReportRow[] = raw.map((r) => ({
        id: r.id,
        reporter_id: r.reporter_id,
        reporter_name: profileMap.get(r.reporter_id) || r.reporter_id.slice(0, 8),
        reported_user_id: r.reported_user_id,
        reported_user_name: r.reported_user_id ? profileMap.get(r.reported_user_id) || r.reported_user_id.slice(0, 8) : null,
        ad_id: r.ad_id,
        ad_title: r.ad_id ? adMap.get(r.ad_id) || null : null,
        message_id: r.message_id,
        message_snippet: r.message_id ? (msgMap.get(r.message_id) || null) : null,
        reason: r.reason,
        description: r.description,
        status: (r.status as ReportStatus) || 'open',
        priority: (r.priority as ReportPriority) || 'medium',
        assigned_to: r.assigned_to,
        assigned_to_name: r.assigned_to ? profileMap.get(r.assigned_to) || r.assigned_to.slice(0, 8) : null,
        resolution: r.resolution,
        created_at: r.created_at,
        resolved_at: r.resolved_at,
      }));

      enriched.sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 99;
        const pb = priorityOrder[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setRows(enriched);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load reports';
      // RLS denial yields specific message; preserve hint
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('not permitted') || msg.toLowerCase().includes('policy')) {
        setLoadError('Access denied — moderator privileges required (RLS).');
      } else {
        setLoadError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isSupabaseConfigured && authError && !isMod) return;
    void fetchReports();
  }, [authLoading, authError, isMod, fetchReports]);

  // Investigation details fetch
  const fetchInvestigation = useCallback(
    async (r: ReportRow) => {
      setInvestigation({ ad: null, reportedUser: null, reporterUser: null, message: null, relatedConversations: [], previousReports: [], moderationHistory: [], otherAds: [], loading: true });

      if (!isSupabaseConfigured) {
        // Mock investigation data
        const mockAd = r.ad_id
          ? { id: r.ad_id, title: r.ad_title || 'Demo Ad', price: 99999, status: 'approved', description: r.description || 'Demo ad description — full details shown in investigation panel.', sellerName: 'Demo Seller', category: 'For Sale', location: 'Delhi', created_at: new Date(Date.now() - 86400000 * 30).toISOString() }
          : null;
        const mockUser = r.reported_user_id
          ? { id: r.reported_user_id, name: r.reported_user_name || 'Demo Reported User', email: 'reported@example.com', role: 'user', account_status: 'active', is_verified: false, created_at: new Date(Date.now() - 86400000 * 200).toISOString(), accountAge: accountAge(new Date(Date.now() - 86400000 * 200).toISOString()) }
          : null;
        const mockReporter = { id: r.reporter_id, name: r.reporter_name, email: 'reporter@example.com', created_at: new Date(Date.now() - 86400000 * 400).toISOString() };
        setInvestigation({
          ad: mockAd,
          reportedUser: mockUser,
          reporterUser: mockReporter,
          message: r.message_id ? { id: r.message_id, message: r.message_snippet || 'Demo message content for investigation preview.', sender_id: r.reported_user_id || 'demo-sender', conversation_id: 'demo-conv-1', created_at: r.created_at } : null,
          relatedConversations: r.ad_id ? [{ id: 'conv-1', ad_id: r.ad_id, ad_title: r.ad_title, buyer_name: 'Buyer A', seller_name: 'Seller B', updated_at: new Date().toISOString() }] : [],
          previousReports: rows.filter((x) => x.id !== r.id && (x.reported_user_id === r.reported_user_id || x.ad_id === r.ad_id)).slice(0, 5),
          moderationHistory: [{ id: 'audit-1', action: 'report_created', created_at: r.created_at, metadata: { reason: r.reason } }],
          otherAds: r.reported_user_id ? [{ id: 'ad-other-1', title: 'Other listing by same user', price: 12000, status: 'approved', created_at: new Date().toISOString() }] : [],
          loading: false,
        });
        return;
      }

      try {
        const sb = getSupabaseBrowser()!;
        // Parallel fetches; each best-effort
        let ad: InvestigationDetails['ad'] = null;
        let reportedUser: InvestigationDetails['reportedUser'] = null;
        let reporterUser: InvestigationDetails['reporterUser'] = null;
        let message: InvestigationDetails['message'] = null;
        let relatedConversations: InvestigationDetails['relatedConversations'] = [];
        let previousReports: ReportRow[] = [];
        let moderationHistory: InvestigationDetails['moderationHistory'] = [];
        let otherAds: InvestigationDetails['otherAds'] = [];

        const tasks: Promise<void>[] = [];

        if (r.ad_id) {
          tasks.push(
            (async () => {
              try {
                const { data } = await sb
                  .from('ads')
                  .select('id, title, price, status, description, created_at, user_id, categories(name), locations(name), profiles:user_id(name)')
                  .eq('id', r.ad_id!)
                  .maybeSingle();
                if (data) {
                  const row = data as unknown as {
                    id: string;
                    title: string;
                    price: number | null;
                    status: string;
                    description: string;
                    created_at: string;
                    categories?: { name: string } | null;
                    locations?: { name: string } | null;
                    profiles?: { name: string } | null;
                  };
                  ad = {
                    id: row.id,
                    title: row.title,
                    price: row.price != null ? Number(row.price) : null,
                    status: row.status,
                    description: row.description,
                    sellerName: (row.profiles as unknown as { name?: string } | null)?.name || '—',
                    category: (row.categories as unknown as { name: string } | null)?.name || '—',
                    location: (row.locations as unknown as { name: string } | null)?.name || '—',
                    created_at: row.created_at,
                  };
                }
              } catch {
                // ignore
              }
            })()
          );
        }

        if (r.reported_user_id) {
          tasks.push(
            (async () => {
              try {
                const { data } = await sb.from('profiles').select('id, name, email, role, account_status, is_verified, created_at').eq('id', r.reported_user_id!).maybeSingle();
                if (data) {
                  const p = data as unknown as { id: string; name: string | null; email: string | null; role: string; account_status: string; is_verified: boolean; created_at: string };
                  reportedUser = {
                    id: p.id,
                    name: p.name || p.id.slice(0, 8),
                    email: p.email || '—',
                    role: p.role,
                    account_status: p.account_status,
                    is_verified: !!p.is_verified,
                    created_at: p.created_at,
                    accountAge: accountAge(p.created_at),
                  };
                }
              } catch {
                // ignore
              }
            })()
          );
        }

        tasks.push(
          (async () => {
            try {
              const { data } = await sb.from('profiles').select('id, name, email, created_at').eq('id', r.reporter_id).maybeSingle();
              if (data) {
                const p = data as unknown as { id: string; name: string | null; email: string | null; created_at: string };
                reporterUser = { id: p.id, name: p.name || p.id.slice(0, 8), email: p.email || '—', created_at: p.created_at };
              }
            } catch {
              // ignore
            }
          })()
        );

        if (r.message_id) {
          tasks.push(
            (async () => {
              try {
                const { data } = await sb.from('messages').select('id, message, sender_id, conversation_id, created_at').eq('id', r.message_id!).maybeSingle();
                if (data) {
                  const m = data as unknown as { id: string; message: string; sender_id: string; conversation_id: string; created_at: string };
                  message = { id: m.id, message: m.message, sender_id: m.sender_id, conversation_id: m.conversation_id, created_at: m.created_at };
                }
              } catch {
                // may lack permission; try message_reports fallback
              }
            })()
          );
        }

        // Related conversations: by ad or by reported user participants
        tasks.push(
          (async () => {
            try {
              if (r.ad_id) {
                const { data } = await sb.from('conversations').select('id, ad_id, buyer_id, seller_id, updated_at, ads(title)').eq('ad_id', r.ad_id!).order('updated_at', { ascending: false }).limit(5);
                if (data && data.length > 0) {
                  const ids = [...new Set([...(data as unknown as { buyer_id: string; seller_id: string }[]).flatMap((c) => [c.buyer_id, c.seller_id])])];
                  let nameMap = new Map<string, string>();
                  if (ids.length > 0) {
                    const { data: profs } = await sb.from('profiles').select('id, name').in('id', ids);
                    if (profs) for (const p of profs as unknown as { id: string; name: string | null }[]) nameMap.set(p.id, p.name || p.id.slice(0, 8));
                  }
                  relatedConversations = (data as unknown as { id: string; ad_id: string | null; updated_at: string; ads?: { title: string } | null; buyer_id: string; seller_id: string }[]).map((c) => ({
                    id: c.id,
                    ad_id: c.ad_id,
                    ad_title: (c.ads as unknown as { title?: string } | null)?.title || ad?.title || null,
                    buyer_name: nameMap.get(c.buyer_id) || c.buyer_id.slice(0, 8),
                    seller_name: nameMap.get(c.seller_id) || c.seller_id.slice(0, 8),
                    updated_at: c.updated_at,
                  }));
                }
              } else if (r.reported_user_id) {
                const { data } = await sb.from('conversations').select('id, ad_id, buyer_id, seller_id, updated_at, ads(title)').or(`buyer_id.eq.${r.reported_user_id},seller_id.eq.${r.reported_user_id}`).order('updated_at', { ascending: false }).limit(5);
                if (data && data.length > 0) {
                  const ids = [...new Set([...(data as unknown as { buyer_id: string; seller_id: string }[]).flatMap((c) => [c.buyer_id, c.seller_id])])];
                  let nameMap = new Map<string, string>();
                  if (ids.length > 0) {
                    const { data: profs } = await sb.from('profiles').select('id, name').in('id', ids);
                    if (profs) for (const p of profs as unknown as { id: string; name: string | null }[]) nameMap.set(p.id, p.name || p.id.slice(0, 8));
                  }
                  relatedConversations = (data as unknown as { id: string; ad_id: string | null; updated_at: string; ads?: { title: string } | null; buyer_id: string; seller_id: string }[]).map((c) => ({
                    id: c.id,
                    ad_id: c.ad_id,
                    ad_title: (c.ads as unknown as { title?: string } | null)?.title || null,
                    buyer_name: nameMap.get(c.buyer_id) || c.buyer_id.slice(0, 8),
                    seller_name: nameMap.get(c.seller_id) || c.seller_id.slice(0, 8),
                    updated_at: c.updated_at,
                  }));
                }
              }
            } catch {
              // ignore
            }
          })()
        );

        // Previous reports for same target
        tasks.push(
          (async () => {
            try {
              let q = sb.from('reports').select('id, reporter_id, reported_user_id, ad_id, message_id, reason, description, status, priority, assigned_to, resolution, created_at, resolved_at').neq('id', r.id).limit(10);
              if (r.reported_user_id) q = q.eq('reported_user_id', r.reported_user_id);
              else if (r.ad_id) q = q.eq('ad_id', r.ad_id);
              else if (r.message_id) q = q.eq('message_id', r.message_id);
              else return;
              const { data } = await q.order('created_at', { ascending: false });
              if (data) {
                previousReports = (data as unknown as ReportRow[]).map((x) => ({
                  ...x,
                  status: x.status as ReportStatus,
                  priority: x.priority as ReportPriority,
                  reporter_name: x.reporter_id?.slice(0, 8) || '—',
                  reported_user_name: null,
                  ad_title: null,
                  message_snippet: null,
                  assigned_to_name: null,
                }));
              }
            } catch {
              // ignore
            }
          })()
        );

        // Moderation history via admin_audit_logs
        tasks.push(
          (async () => {
            try {
              const targetIds = [r.id, r.ad_id, r.reported_user_id].filter(Boolean) as string[];
              if (targetIds.length === 0) return;
              const { data } = await sb.from('admin_audit_logs').select('id, action, created_at, metadata').in('entity_id', targetIds).order('created_at', { ascending: false }).limit(12);
              if (data) moderationHistory = data as unknown as InvestigationDetails['moderationHistory'];
            } catch {
              // ignore (RLS admin only - moderator should have access via is_moderator? but audit may be admin-only; keep empty)
            }
          })()
        );

        // Other ads by reported user
        tasks.push(
          (async () => {
            if (!r.reported_user_id) return;
            try {
              const { data } = await sb.from('ads').select('id, title, price, status, created_at').eq('user_id', r.reported_user_id!).neq('status', 'deleted').order('created_at', { ascending: false }).limit(8);
              if (data) otherAds = data as unknown as InvestigationDetails['otherAds'];
            } catch {
              // ignore
            }
          })()
        );

        await Promise.all(tasks);
        setInvestigation({ ad, reportedUser, reporterUser, message, relatedConversations, previousReports, moderationHistory, otherAds, loading: false });
      } catch {
        setInvestigation({ ad: null, reportedUser: null, reporterUser: null, message: null, relatedConversations: [], previousReports: [], moderationHistory: [], otherAds: [], loading: false });
      }
    },
    [rows]
  );

  useEffect(() => {
    if (selected) void fetchInvestigation(selected);
    else setInvestigation(null);
  }, [selected, fetchInvestigation]);

  // update helpers

  const persistReportUpdate = useCallback(
    async (id: string, patch: Partial<Record<keyof ReportRow, string | null>>) => {
      // map camel to db columns
      const dbPatch: Record<string, unknown> = {};
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.priority !== undefined) dbPatch.priority = patch.priority;
      if (patch.assigned_to !== undefined) dbPatch.assigned_to = patch.assigned_to || null;
      if (patch.resolution !== undefined) dbPatch.resolution = patch.resolution;
      if (patch.status === 'resolved' || patch.status === 'dismissed') dbPatch.resolved_at = new Date().toISOString();
      if (patch.status === 'open' || patch.status === 'investigating') dbPatch.resolved_at = null;

      if (!isSupabaseConfigured) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, ...(patch.assigned_to !== undefined ? { assigned_to_name: patch.assigned_to ? moderators.find((m) => m.id === patch.assigned_to)?.name || patch.assigned_to.slice(0, 8) : null } : {}) } as ReportRow : r)));
        if (selected?.id === id) setSelected((prev) => (prev ? ({ ...prev, ...patch } as ReportRow) : prev));
        return;
      }

      const sb = getSupabaseBrowser()!;
      const { error } = await sb.from('reports').update(dbPatch as never).eq('id', id);
      if (error) throw error;

      // audit best-effort
      try {
        if (currentUserId) {
          await sb.from('admin_audit_logs').insert({
            admin_id: currentUserId,
            action: 'report_updated',
            entity_type: 'report',
            entity_id: id,
            metadata: dbPatch as never,
          } as never);
        }
      } catch {
        // ignore audit
      }

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, ...(patch.assigned_to !== undefined ? { assigned_to_name: patch.assigned_to ? moderators.find((m) => m.id === patch.assigned_to)?.name || patch.assigned_to.slice(0, 8) : null } : {} ), ...(patch.status === 'resolved' || patch.status === 'dismissed' ? { resolved_at: new Date().toISOString() } : patch.status === 'open' || patch.status === 'investigating' ? { resolved_at: null } : {}) } as ReportRow : r)));
      if (selected?.id === id) {
        setSelected((prev) => (prev ? ({ ...prev, ...patch } as ReportRow) : prev));
      }
    },
    [currentUserId, moderators, selected]
  );

  const handleInvestigate = useCallback(
    async (r: ReportRow) => {
      if (!isMod) {
        toast('Only moderators can update reports.');
        return;
      }
      setActionLoading(true);
      try {
        await persistReportUpdate(r.id, { status: 'investigating', assigned_to: currentUserId || r.assigned_to });
        toast('Report moved to investigating.');
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : 'Failed to update report.');
      } finally {
        setActionLoading(false);
      }
    },
    [isMod, persistReportUpdate, currentUserId, toast]
  );

  const handleResolve = useCallback(
    async (r: ReportRow, resolutionText?: string) => {
      if (!isMod) {
        toast('Only moderators can resolve reports.');
        return;
      }
      const res = (resolutionText ?? editResolution).trim();
      if (!res) {
        toast('Resolution note is required.');
        return;
      }
      setActionLoading(true);
      try {
        await persistReportUpdate(r.id, { status: 'resolved', resolution: res });
        toast('Report resolved.');
        setConfirmResolve(null);
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : 'Failed to resolve report.');
      } finally {
        setActionLoading(false);
      }
    },
    [isMod, persistReportUpdate, editResolution, toast]
  );

  const handleDismiss = useCallback(
    async (r: ReportRow, resolutionText?: string) => {
      if (!isMod) {
        toast('Only moderators can dismiss reports.');
        return;
      }
      setActionLoading(true);
      try {
        const res = (resolutionText ?? editResolution).trim() || 'Dismissed — no violation found.';
        await persistReportUpdate(r.id, { status: 'dismissed', resolution: res });
        toast('Report dismissed.');
        setConfirmDismiss(null);
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : 'Failed to dismiss report.');
      } finally {
        setActionLoading(false);
      }
    },
    [isMod, persistReportUpdate, editResolution, toast]
  );

  const handleSaveEdits = useCallback(async () => {
    if (!selected) return;
    if (!isMod) {
      toast('Only moderators can update reports.');
      return;
    }
    setActionLoading(true);
    try {
      await persistReportUpdate(selected.id, {
        status: editStatus,
        priority: editPriority,
        assigned_to: editAssignee || null,
        resolution: editResolution || null,
      });
      toast('Report updated.');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setActionLoading(false);
    }
  }, [selected, isMod, persistReportUpdate, editStatus, editPriority, editAssignee, editResolution, toast]);

  // derived filtered & paginated

  const filteredSorted = useMemo(() => {
    const q = debouncedSearch;
    let out = rows.filter((r) => {
      const type = getReportType(r);
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        r.reporter_name.toLowerCase().includes(q) ||
        (r.reported_user_name || '').toLowerCase().includes(q) ||
        (r.ad_title || '').toLowerCase().includes(q) ||
        (r.message_snippet || '').toLowerCase().includes(q) ||
        (r.assigned_to_name || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchesPriority = priorityFilter === 'All' || r.priority === priorityFilter;
      const matchesType = typeFilter === 'All' || type === typeFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesType;
    });
    out.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 99;
      const pb = priorityOrder[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return out;
  }, [rows, debouncedSearch, statusFilter, priorityFilter, typeFilter]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSorted.slice(start, start + PAGE_SIZE);
  }, [filteredSorted, page]);

  // Early states
  if (authLoading) {
    return (
      <div className="space-y-5">
        <div className="h-10 w-40 bg-slate-100 rounded-xl animate-pulse" />
        <div className="bg-white rounded-2xl border border-slate-100 p-10 flex items-center justify-center gap-2 text-black">
          <Loader2 className="w-5 h-5 animate-spin" /> Verifying moderator access...
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured && authError && !isMod) {
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
          <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">Reports</h1>
          <p className="text-xs text-black mt-1">
            {loading ? 'Loading...' : `${total.toLocaleString('en-IN')} report${total !== 1 ? 's' : ''} — sorted critical → low, then newest`}
            {!isSupabaseConfigured && <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">Demo data — Supabase not configured</span>}
            {currentRole && <span className="ml-2 text-[11px] font-semibold">Signed in as <span className="font-black capitalize">{currentRole.replace('_', ' ')}</span></span>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-black">
          <span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical</span>
          <span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" /> High</span>
          <span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
          <span className="hidden sm:inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> Low</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-grow relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
          <Input
            placeholder="Search by report ID, reporter, target, reason, assignee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search reports"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <div className="w-40">
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} options={PRIORITY_OPTIONS} aria-label="Filter by priority" />
          </div>
          <div className="w-36">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={TYPE_OPTIONS} aria-label="Filter by type" />
          </div>
        </div>
      </div>

      <FilterTabs tabs={STATUS_TABS} active={statusFilter} onChange={setStatusFilter} />

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" aria-busy="true">
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-16 h-6 rounded-full bg-slate-100" />
                <div className="flex-grow space-y-2">
                  <div className="h-4 w-48 rounded bg-slate-200" />
                  <div className="h-3 w-64 rounded bg-slate-100" />
                </div>
                <div className="w-20 h-6 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-red-100 p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#D32F2F]">{loadError}</p>
          <p className="text-xs text-black mt-1">Only moderators can read/update reports (RLS: public.is_moderator()).</p>
          <button onClick={() => void fetchReports()} className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold hover:bg-[#D32F2F] transition-colors">Retry</button>
        </div>
      ) : paginated.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
            <Flag className="w-6 h-6 text-black" />
          </div>
          <p className="text-sm font-semibold text-black">Queue clear — no reports match your filters.</p>
          <p className="text-xs text-black mt-1">Try a different status, priority or search.</p>
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('All');
              setPriorityFilter('All');
              setTypeFilter('All');
            }}
            className="mt-4 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <DataTable headers={['Report ID', 'Type', 'Reporter', 'Target', 'Reason', 'Priority', 'Status', 'Created', 'Assigned Moderator', 'Actions']}>
            {paginated.map((r) => {
              const type = getReportType(r);
              return (
                <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="pl-5 pr-3 py-3.5">
                    <span className="font-mono text-xs font-bold text-[#0F172A]">{r.id.slice(0, 8)}</span>
                    <span className="block text-[11px] text-black font-mono">{r.id.slice(0, 18)}…</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${typeCls[type]}`}>{type}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="block text-xs font-semibold text-[#0F172A] truncate max-w-[120px]" title={r.reporter_name}>{r.reporter_name}</span>
                    <span className="block text-[11px] text-black font-mono truncate max-w-[120px]">{r.reporter_id.slice(0, 8)}…</span>
                  </td>
                  <td className="px-3 py-3.5 max-w-[180px]">
                    <span className="block text-xs font-semibold text-black truncate" title={getTargetLabel(r)}>{getTargetLabel(r)}</span>
                    <span className="block text-[11px] text-black truncate">
                      {type === 'ad' && r.ad_id ? `Ad ${r.ad_id.slice(0, 8)}…` : type === 'user' && r.reported_user_id ? `User ${r.reported_user_id.slice(0, 8)}…` : type === 'message' && r.message_id ? `Msg ${r.message_id.slice(0, 8)}…` : truncate(r.description || '', 32)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${reasonCls[r.reason] || reasonCls.Other}`}>{r.reason}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${priorityCls[r.priority]}`}>
                      {r.priority === 'critical' && <ShieldAlert className="w-3 h-3" />}
                      {r.priority === 'high' && <AlertTriangle className="w-3 h-3" />}
                      {r.priority}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${statusCls[r.status]}`}>
                      {r.status === 'open' && <Clock className="w-3 h-3" />}
                      {r.status === 'investigating' && <Search className="w-3 h-3" />}
                      {r.status === 'resolved' && <CheckCircle2 className="w-3 h-3" />}
                      {r.status === 'dismissed' && <XCircle className="w-3 h-3" />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-black whitespace-nowrap text-xs">
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3 text-black" />{formatDate(r.created_at)}</span>
                  </td>
                  <td className="px-3 py-3.5 text-xs max-w-[120px] truncate">
                    {r.assigned_to_name ? <span className="font-semibold text-[#0F172A]" title={r.assigned_to_name}>{r.assigned_to_name}</span> : <span className="text-black">Unassigned</span>}
                  </td>
                  <td className="pr-5 pl-3 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelected(r)} title="Investigate / view details" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-black transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      {r.status === 'open' && (
                        <button
                          onClick={() => void handleInvestigate(r)}
                          disabled={actionLoading}
                          title="Investigate (open → investigating)"
                          className="p-2 rounded-lg hover:bg-blue-50 hover:text-blue-700 text-black transition-colors disabled:opacity-40"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      )}
                      {r.status !== 'resolved' && (
                        <button
                          onClick={() => setConfirmResolve(r)}
                          title="Resolve"
                          className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-black transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {r.status !== 'dismissed' && (
                        <button
                          onClick={() => setConfirmDismiss(r)}
                          title="Dismiss"
                          className="p-2 rounded-lg hover:bg-slate-100 text-black transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          <p className="text-center text-[11px] text-black">Page {page} of {totalPages} — {total.toLocaleString('en-IN')} reports • {PAGE_SIZE}/page</p>
        </>
      )}

      {/* Investigation panel */}
      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected ? `Report ${selected.id.slice(0, 8)} — Investigation` : 'Report'} size="xl">
        {selected && (
          <div className="space-y-6">
            {/* Summary header */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${priorityCls[selected.priority]}`}>{selected.priority} priority</span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${statusCls[selected.status]}`}>{selected.status}</span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize ${typeCls[getReportType(selected)]}`}>{getReportType(selected)}</span>
              <span className="text-[11px] text-black">Created {formatDateTime(selected.created_at)}</span>
              {selected.resolved_at && <span className="text-[11px] text-black">Resolved {formatDateTime(selected.resolved_at)}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl px-3 py-3 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wide text-black">Reason</p>
                <p className="font-bold text-[#0F172A] mt-1">{selected.reason}</p>
                <p className="text-xs text-black leading-relaxed mt-1">{selected.description || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-3 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wide text-black">Reporter &amp; Target</p>
                <p className="text-xs mt-1"><span className="text-black">Reporter:</span> <span className="font-semibold text-[#0F172A]">{selected.reporter_name}</span> <span className="font-mono text-[11px] text-black">({selected.reporter_id.slice(0, 8)}…)</span></p>
                <p className="text-xs mt-1"><span className="text-black">Target:</span> <span className="font-semibold">{getTargetLabel(selected)}</span></p>
                {selected.reported_user_id && <p className="text-[11px] text-black mt-1 font-mono">User {selected.reported_user_id}</p>}
                {selected.ad_id && <p className="text-[11px] text-black font-mono">Ad {selected.ad_id}</p>}
                {selected.message_id && <p className="text-[11px] text-black font-mono">Msg {selected.message_id}</p>}
              </div>
            </div>

            {/* Moderation controls */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
              <h4 className="text-sm font-black text-[#0F172A] flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#E53935]" /> Moderation actions</h4>
              <div className="grid sm:grid-cols-3 gap-3">
                <Select label="Status" value={editStatus} onChange={(e) => setEditStatus(e.target.value as ReportStatus)} options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
                <Select label="Priority" value={editPriority} onChange={(e) => setEditPriority(e.target.value as ReportPriority)} options={PRIORITY_EDIT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
                <Select
                  label="Assigned moderator"
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  options={[{ value: '', label: 'Unassigned' }, ...moderators.map((m) => ({ value: m.id, label: m.name }))]}
                />
              </div>
              <Input label="Resolution note" placeholder="Reason for resolve / dismiss — visible in audit & to reporter" value={editResolution} onChange={(e) => setEditResolution(e.target.value)} hint="Required when resolving. Stored as reports.resolution." />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void handleSaveEdits()} disabled={actionLoading || !isMod} className="px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save changes
                </button>
                {selected.status === 'open' && (
                  <button onClick={() => void handleInvestigate(selected)} disabled={actionLoading || !isMod} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5" /> Investigate
                  </button>
                )}
                <button onClick={() => setConfirmResolve(selected)} disabled={actionLoading || !isMod || !editResolution.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                </button>
                <button onClick={() => setConfirmDismiss(selected)} disabled={actionLoading || !isMod} className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Dismiss
                </button>
              </div>
              {!isMod && <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Only moderators can update reports (enforced by RLS).</p>}
            </div>

            {/* Investigation details */}
            <div className="space-y-4">
              <h4 className="text-sm font-black text-[#0F172A] flex items-center gap-2"><Eye className="w-4 h-4 text-[#E53935]" /> Investigation</h4>

              {investigation?.loading ? (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-8 flex items-center justify-center gap-2 text-black">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading related data...
                </div>
              ) : (
                <div className="grid lg:grid-cols-2 gap-4">
                  {/* Reported ad */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-wide text-black flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> Reported ad</h5>
                    {investigation?.ad ? (
                      <div className="space-y-2 text-sm">
                        <p className="font-bold text-[#0F172A]">{investigation.ad.title}</p>
                        <p className="text-xs text-black">{investigation.ad.category} · {investigation.ad.location} · <span className="capitalize">{investigation.ad.status}</span> · ₹{investigation.ad.price != null ? Number(investigation.ad.price).toLocaleString('en-IN') : '—'}</p>
                        <p className="text-xs text-black leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">{investigation.ad.description || 'No description'}</p>
                        <p className="text-[11px] text-black">Seller: <span className="font-semibold text-black">{investigation.ad.sellerName}</span> · Created {formatDate(investigation.ad.created_at)}</p>
                        <Link href={`/admin/ads?search=${encodeURIComponent(investigation.ad.id)}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#E53935] hover:underline">Open in moderation queue <ChevronRight className="w-3 h-3" /></Link>
                      </div>
                    ) : selected.ad_id ? (
                      <p className="text-xs text-black">Ad {selected.ad_id.slice(0, 8)}… — details unavailable (deleted or no permission).</p>
                    ) : (
                      <p className="text-xs text-black">No ad associated with this report.</p>
                    )}
                  </div>

                  {/* Reported user */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-wide text-black flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Reported user</h5>
                    {investigation?.reportedUser ? (
                      <div className="space-y-2 text-sm">
                        <p className="font-bold text-[#0F172A]">{investigation.reportedUser.name}</p>
                        <p className="text-xs text-black truncate">{investigation.reportedUser.email}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-bold border capitalize ${investigation.reportedUser.account_status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : investigation.reportedUser.account_status === 'suspended' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-[#D32F2F] border-red-100'}`}>{investigation.reportedUser.account_status}</span>
                          <span className="inline-flex px-2 py-1 rounded-full text-[11px] font-bold border bg-slate-50 text-black capitalize">{investigation.reportedUser.role.replace('_', ' ')}</span>
                          {investigation.reportedUser.is_verified ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"><ShieldCheck className="w-3 h-3" /> Verified</span> : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-black border">Unverified</span>}
                        </div>
                        <p className="text-xs text-black">Account age: <span className="font-semibold text-[#0F172A]">{investigation.reportedUser.accountAge}</span> · Joined {formatDate(investigation.reportedUser.created_at)}</p>
                        <Link href={`/admin/users?search=${encodeURIComponent(investigation.reportedUser.id)}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#E53935] hover:underline">Open user profile <ChevronRight className="w-3 h-3" /></Link>
                      </div>
                    ) : selected.reported_user_id ? (
                      <p className="text-xs text-black">User {selected.reported_user_id.slice(0, 8)}… — profile unavailable.</p>
                    ) : (
                      <p className="text-xs text-black">No user directly reported.</p>
                    )}
                    {investigation?.otherAds && investigation.otherAds.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-black flex items-center gap-1"><Layers className="w-3 h-3" /> Other ads by this user ({investigation.otherAds.length})</p>
                        <ul className="mt-2 space-y-1.5">
                          {investigation.otherAds.map((a) => (
                            <li key={a.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                              <span className="font-semibold truncate max-w-[180px]">{a.title}</span>
                              <span className="text-black shrink-0 ml-2">{a.status}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Reported message */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-wide text-black flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Reported message</h5>
                    {investigation?.message ? (
                      <div className="space-y-2 text-sm">
                        <p className="text-xs text-black leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100 whitespace-pre-wrap break-words">{investigation.message.message}</p>
                        <p className="text-[11px] text-black">From <span className="font-mono">{investigation.message.sender_id.slice(0, 8)}…</span> · Conversation {investigation.message.conversation_id.slice(0, 8)}… · {formatDateTime(investigation.message.created_at)}</p>
                        <Link href="/admin/messages" className="inline-flex items-center gap-1 text-xs font-bold text-[#E53935] hover:underline">Open messages admin <ChevronRight className="w-3 h-3" /></Link>
                      </div>
                    ) : selected.message_id ? (
                      <p className="text-xs text-black">Message {selected.message_id.slice(0, 8)}… — content unavailable (RLS).</p>
                    ) : (
                      <p className="text-xs text-black">No message associated.</p>
                    )}
                  </div>

                  {/* Related conversations */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-wide text-black flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Related conversations</h5>
                    {investigation?.relatedConversations && investigation.relatedConversations.length > 0 ? (
                      <ul className="space-y-2">
                        {investigation.relatedConversations.map((c) => (
                          <li key={c.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                            <span className="min-w-0">
                              <span className="block font-semibold truncate max-w-[200px]">{c.ad_title || `Conversation ${c.id.slice(0, 8)}`}</span>
                              <span className="block text-[11px] text-black">{c.buyer_name} ↔ {c.seller_name}</span>
                            </span>
                            <span className="text-[11px] text-black shrink-0">{formatDate(c.updated_at)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-black">No related conversations found.</p>
                    )}
                  </div>

                  {/* Previous reports */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-wide text-black flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> Previous reports ({investigation?.previousReports.length ?? 0})</h5>
                    {investigation?.previousReports && investigation.previousReports.length > 0 ? (
                      <ul className="space-y-2">
                        {investigation.previousReports.map((pr) => (
                          <li key={pr.id} className="text-xs bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                            <span className="flex items-center gap-1.5">
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${priorityCls[pr.priority]}`}>{pr.priority}</span>
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${statusCls[pr.status]}`}>{pr.status}</span>
                              <span className="text-black">{formatDate(pr.created_at)}</span>
                            </span>
                            <span className="block mt-1 font-semibold">{pr.reason}</span>
                            <span className="block text-black truncate">{pr.description || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-black">No prior reports for this target.</p>
                    )}
                  </div>

                  {/* Moderation history */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-wide text-black flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Moderation history</h5>
                    {investigation?.moderationHistory && investigation.moderationHistory.length > 0 ? (
                      <ul className="space-y-1.5">
                        {investigation.moderationHistory.map((h) => (
                          <li key={h.id} className="flex items-start gap-2 text-xs bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                            <FileText className="w-3.5 h-3.5 text-black mt-0.5 shrink-0" />
                            <span className="min-w-0">
                              <span className="font-semibold">{h.action}</span>
                              <span className="block text-[11px] text-black">{formatDateTime(h.created_at)}</span>
                              {h.metadata ? <span className="block text-[11px] text-black font-mono truncate">{JSON.stringify(h.metadata).slice(0, 120)}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-black">No audit entries for this report / target. Actions are written to admin_audit_logs when available.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setSelected(null)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDismiss !== null}
        onClose={() => setConfirmDismiss(null)}
        onConfirm={() => confirmDismiss && void handleDismiss(confirmDismiss)}
        title="Dismiss report?"
        message={confirmDismiss ? `Report ${confirmDismiss.id.slice(0, 8)} will be marked dismissed. Reason: "${confirmDismiss.reason}" — resolution will be saved.` : ''}
        confirmLabel={actionLoading ? 'Dismissing...' : 'Dismiss'}
        danger={false}
      />

      <ConfirmDialog
        open={confirmResolve !== null}
        onClose={() => setConfirmResolve(null)}
        onConfirm={() => confirmResolve && void handleResolve(confirmResolve)}
        title="Resolve report?"
        message={confirmResolve ? `Report ${confirmResolve.id.slice(0, 8)} will be marked resolved. Ensure a resolution note is saved.` : ''}
        confirmLabel={actionLoading ? 'Resolving...' : 'Resolve'}
        danger={false}
      />
    </div>
  );
}
