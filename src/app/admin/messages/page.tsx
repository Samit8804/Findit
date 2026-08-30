'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, MessageSquare, Eye, Loader2, Clock, User, ShoppingBag } from 'lucide-react';
import { DataTable, Input, Pagination } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Feedback';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { conversations as mockConversations } from '@/data/accountData';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface AdminConversationRow {
  id: string;
  adId: string | null;
  adTitle: string;
  buyerId: string | null;
  buyerName: string;
  sellerId: string | null;
  sellerName: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastPreview: string;
}

interface AdminMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

const PAGE_SIZE = 20;

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
    return d.toLocaleString('en-IN', {
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

function truncate(s: string, n = 48): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// ------------------------------------------------------------------
// Mock mapping — conversations from src/data/accountData.ts
// Shape: { id, name, adRef, messages: {from,text,time}[], lastTime }
// We synthesize buyer/seller + dates so the table stays meaningful.
// ------------------------------------------------------------------

function mockToRows(): AdminConversationRow[] {
  // Spread deterministic fake dates across conversations
  const base = new Date('2026-08-18T10:00:00+05:30').getTime();
  return mockConversations.map((c, idx) => {
    const createdAt = new Date(base - (mockConversations.length - idx) * 86400000 * 2).toISOString();
    // updated = last message time if parseable, otherwise base + idx
    const updatedAt = new Date(base + idx * 3600000 * 6).toISOString();
    const lastPreview = c.messages.length > 0 ? c.messages[c.messages.length - 1]!.text : '—';
    return {
      id: c.id,
      adId: `mock-ad-${idx + 1}`,
      adTitle: c.adRef,
      buyerId: `mock-buyer-${c.id}`,
      buyerName: c.name,
      sellerId: 'mock-seller-you',
      sellerName: 'Seller (You)',
      createdAt,
      updatedAt,
      messageCount: c.messages.length,
      lastPreview,
    };
  });
}

function mockMessagesFor(conversationId: string): AdminMessage[] {
  const conv = mockConversations.find((c) => c.id === conversationId);
  if (!conv) return [];
  return conv.messages.map((m, i) => ({
    id: `${conversationId}-m-${i}`,
    senderId: m.from === 'me' ? 'mock-seller-you' : `mock-buyer-${conv.id}`,
    senderName: m.from === 'me' ? 'Seller (You)' : conv.name,
    message: m.text,
    createdAt: m.time,
    isRead: true,
  }));
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminMessagesPage() {
  const [rows, setRows] = useState<AdminConversationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // read-only message view
  const [selected, setSelected] = useState<AdminConversationRow | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Keep selected in sync after list refresh
  useEffect(() => {
    if (selected) {
      const updated = rows.find((r) => r.id === selected.id);
      if (updated) setSelected(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    // ---------------- Mock fallback ----------------
    if (!isSupabaseConfigured) {
      const all = mockToRows();
      const q = debouncedSearch.toLowerCase();
      let filtered = all;
      if (q) {
        filtered = all.filter(
          (r) =>
            r.adTitle.toLowerCase().includes(q) ||
            r.buyerName.toLowerCase().includes(q) ||
            r.sellerName.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q)
        );
      }
      // newest first
      filtered = filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setTotal(filtered.length);
      const start = (page - 1) * PAGE_SIZE;
      setRows(filtered.slice(start, start + PAGE_SIZE));
      setLoading(false);
      return;
    }

    // ---------------- Supabase ----------------
    try {
      const sb = getSupabaseBrowser()!;
      const q = debouncedSearch.trim();

      // When searching, fetch a larger window then filter client-side
      // so buyer/seller/adTitle search works without complex join filters.
      const useClientFilter = q.length > 0;

      if (useClientFilter) {
        // Fetch up to 500 most recent conversations for client filtering
        const { data, error } = await sb
          .from('conversations')
          .select(
            `
              id, ad_id, buyer_id, seller_id, created_at, updated_at,
              ads(title),
              buyer:profiles!conversations_buyer_id_fkey(id, name),
              seller:profiles!conversations_seller_id_fkey(id, name)
            `
          )
          .order('updated_at', { ascending: false })
          .limit(500);

        if (error) throw error;

        const convs = (data || []) as unknown as Array<{
          id: string;
          ad_id: string | null;
          buyer_id: string | null;
          seller_id: string | null;
          created_at: string;
          updated_at: string;
          ads: { title: string | null } | null;
          buyer: { id: string; name: string | null } | null;
          seller: { id: string; name: string | null } | null;
        }>;

        if (convs.length === 0) {
          setRows([]);
          setTotal(0);
          setLoading(false);
          return;
        }

        const ids = convs.map((c) => c.id);

        // Fetch message aggregates for these ids
        let msgMap = new Map<string, { count: number; last: string }>();
        try {
          const { data: msgRows } = await sb
            .from('messages')
            .select('conversation_id, message, created_at')
            .in('conversation_id', ids)
            .order('created_at', { ascending: false });

          if (msgRows) {
            const grouped = new Map<string, { count: number; last: string }>();
            for (const m of msgRows as unknown as { conversation_id: string; message: string; created_at: string }[]) {
              const prev = grouped.get(m.conversation_id);
              if (!prev) grouped.set(m.conversation_id, { count: 1, last: m.message });
              else grouped.set(m.conversation_id, { count: prev.count + 1, last: prev.last });
            }
            msgMap = grouped;
          }
        } catch {
          // non-critical
        }

        let mapped: AdminConversationRow[] = convs.map((c) => {
          const agg = msgMap.get(c.id);
          return {
            id: c.id,
            adId: c.ad_id,
            adTitle: c.ads?.title || '—',
            buyerId: c.buyer_id,
            buyerName: c.buyer?.name || 'Unknown buyer',
            sellerId: c.seller_id,
            sellerName: c.seller?.name || 'Unknown seller',
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            messageCount: agg?.count ?? 0,
            lastPreview: agg?.last ? truncate(agg.last, 64) : '—',
          };
        });

        const qLower = q.toLowerCase();
        mapped = mapped.filter(
          (r) =>
            r.adTitle.toLowerCase().includes(qLower) ||
            r.buyerName.toLowerCase().includes(qLower) ||
            r.sellerName.toLowerCase().includes(qLower) ||
            r.id.toLowerCase().includes(qLower)
        );

        setTotal(mapped.length);
        const start = (page - 1) * PAGE_SIZE;
        setRows(mapped.slice(start, start + PAGE_SIZE));
        setLoading(false);
        return;
      }

      // No search — server pagination with exact count
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await sb
        .from('conversations')
        .select(
          `
            id, ad_id, buyer_id, seller_id, created_at, updated_at,
            ads(title),
            buyer:profiles!conversations_buyer_id_fkey(id, name),
            seller:profiles!conversations_seller_id_fkey(id, name)
          `,
          { count: 'exact' }
        )
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const convs = (data || []) as unknown as Array<{
        id: string;
        ad_id: string | null;
        buyer_id: string | null;
        seller_id: string | null;
        created_at: string;
        updated_at: string;
        ads: { title: string | null } | null;
        buyer: { id: string; name: string | null } | null;
        seller: { id: string; name: string | null } | null;
      }>;

      setTotal(count ?? 0);

      if (convs.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const ids = convs.map((c) => c.id);

      // Message aggregates for this page only
      const msgAgg = new Map<string, { count: number; last: string }>();
      try {
        const { data: msgRows } = await sb
          .from('messages')
          .select('conversation_id, message, created_at')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false });

        if (msgRows) {
          for (const m of msgRows as unknown as { conversation_id: string; message: string; created_at: string }[]) {
            const prev = msgAgg.get(m.conversation_id);
            if (!prev) msgAgg.set(m.conversation_id, { count: 1, last: m.message });
            else msgAgg.set(m.conversation_id, { count: prev.count + 1, last: prev.last });
          }
        }
      } catch {
        // ignore
      }

      const mapped: AdminConversationRow[] = convs.map((c) => {
        const agg = msgAgg.get(c.id);
        return {
          id: c.id,
          adId: c.ad_id,
          adTitle: c.ads?.title || '—',
          buyerId: c.buyer_id,
          buyerName: c.buyer?.name || 'Unknown buyer',
          sellerId: c.seller_id,
          sellerName: c.seller?.name || 'Unknown seller',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          messageCount: agg?.count ?? 0,
          lastPreview: agg?.last ? truncate(agg.last, 64) : '—',
        };
      });

      setRows(mapped);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load conversations';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const openConversation = useCallback(async (row: AdminConversationRow) => {
    setSelected(row);
    setMessages([]);
    setMsgError('');
    setMsgLoading(true);

    if (!isSupabaseConfigured) {
      // mock branch — synchronous
      setMessages(mockMessagesFor(row.id));
      setMsgLoading(false);
      return;
    }

    try {
      const sb = getSupabaseBrowser()!;
      // Fetch messages with sender profile for display
      const { data, error } = await sb
        .from('messages')
        .select('id, sender_id, message, created_at, is_read, sender:profiles!messages_sender_id_fkey(id, name)')
        .eq('conversation_id', row.id)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;

      const mapped: AdminMessage[] = ((data || []) as unknown as Array<{
        id: string;
        sender_id: string | null;
        message: string;
        created_at: string;
        is_read: boolean | null;
        sender: { id: string; name: string | null } | null;
      }>).map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender?.name || (m.sender_id === row.buyerId ? row.buyerName : row.sellerName) || 'Unknown',
        message: m.message,
        createdAt: m.created_at,
        isRead: !!m.is_read,
      }));

      setMessages(mapped);
    } catch (e: unknown) {
      setMsgError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setMsgLoading(false);
    }
  }, []);

  const headerCount = useMemo(() => total.toLocaleString('en-IN'), [total]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">Messages</h1>
          <p className="text-xs text-slate-700 mt-1">
            {loading ? 'Loading…' : `${headerCount} conversations`}
            {!isSupabaseConfigured && (
              <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                Demo data — Supabase not configured
              </span>
            )}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E53935]" /> Oversight
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-600" /> Read-only
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 pointer-events-none" />
          <Input
            placeholder="Search by ad title, buyer or seller…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search conversations"
            className="pl-9"
          />
        </div>
        <p className="text-[11px] text-slate-700 mt-2">
          Tip: click a row to open the read-only transcript. Admins cannot send messages from this view.
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" aria-busy="true">
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-20 h-4 rounded bg-slate-200" />
                <div className="flex-grow space-y-2">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-56 rounded bg-slate-100" />
                </div>
                <div className="hidden sm:block w-24 h-4 rounded bg-slate-100" />
                <div className="hidden md:block w-16 h-6 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
          <p className="text-sm font-semibold text-[#D32F2F]">{loadError}</p>
          <button
            onClick={() => void fetchConversations()}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold hover:bg-[#D32F2F] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6 text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No conversations match your search.</p>
          <p className="text-xs text-slate-700 mt-1">Try a different term or clear the search.</p>
          {debouncedSearch && (
            <button
              onClick={() => setSearch('')}
              className="mt-4 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          <DataTable
            headers={['Conversation ID', 'Ad title', 'Buyer', 'Seller', 'Created', 'Updated', 'Messages', 'Last message', '']}
          >
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => void openConversation(r)}
                className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                title="Open read-only transcript"
              >
                <td className="pl-5 pr-3 py-3.5">
                  <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg whitespace-nowrap" title={r.id}>
                    {r.id.slice(0, 8)}…{r.id.slice(-4)}
                  </span>
                  <span className="block font-mono text-[10px] text-slate-700 mt-1 truncate max-w-[140px]" title={r.id}>
                    {r.id}
                  </span>
                </td>
                <td className="px-3 py-3.5 max-w-[220px]">
                  <span className="flex items-center gap-1.5 font-semibold text-[#0F172A] truncate" title={r.adTitle}>
                    <ShoppingBag className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span className="truncate">{r.adTitle}</span>
                  </span>
                  {r.adId && <span className="block text-[10px] font-mono text-slate-700 truncate mt-0.5">{r.adId.slice(0, 12)}…</span>}
                </td>
                <td className="px-3 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap" title={r.buyerId || undefined}>
                    <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center text-[11px] font-black shrink-0">
                      {r.buyerName.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate max-w-[120px]">{r.buyerName}</span>
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap" title={r.sellerId || undefined}>
                    <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center text-[11px] font-black shrink-0">
                      {r.sellerName.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate max-w-[120px]">{r.sellerName}</span>
                  </span>
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {formatDate(r.createdAt)}
                  </span>
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-700">{formatDate(r.updatedAt)}</td>
                <td className="px-3 py-3.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700">
                    <MessageSquare className="w-3 h-3 text-slate-700" />
                    {r.messageCount}
                  </span>
                </td>
                <td className="px-3 py-3.5 max-w-[200px]">
                  <span className="block text-xs text-slate-600 truncate" title={r.lastPreview}>
                    {r.lastPreview}
                  </span>
                </td>
                <td className="pr-5 pl-3 py-3.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void openConversation(r);
                    }}
                    aria-label={`Open conversation ${r.id}`}
                    className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-700 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          <p className="text-center text-[11px] text-slate-700">
            Page {page} of {totalPages} — {total.toLocaleString('en-IN')} conversations • {PAGE_SIZE}/page
          </p>
        </>
      )}

      {/* Read-only transcript */}
      <Modal open={selected !== null} onClose={() => setSelected(null)} title="Conversation — read-only" size="lg">
        {selected && (
          <div className="space-y-4">
            {/* Meta header */}
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">Advertisement</p>
                  <p className="font-bold text-[#0F172A] mt-1 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-[#E53935] text-white flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </span>
                    <span className="truncate">{selected.adTitle}</span>
                  </p>
                  <p className="text-[11px] font-mono text-slate-700 mt-1 truncate">Ad: {selected.adId || '—'} · Conversation: {selected.id}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600">
                    <User className="w-3 h-3" /> Buyer: {selected.buyerName}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600">
                    <User className="w-3 h-3" /> Seller: {selected.sellerName}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                <div className="bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Created</p>
                  <p className="text-xs font-bold text-[#0F172A] mt-1">{formatDate(selected.createdAt)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Updated</p>
                  <p className="text-xs font-bold text-[#0F172A] mt-1">{formatDate(selected.updatedAt)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Messages</p>
                  <p className="text-xs font-black text-[#E53935] mt-1">{selected.messageCount}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-700 mt-3 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Read-only oversight — admins cannot send messages from this view.
              </p>
            </div>

            {/* Messages */}
            {msgLoading ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 flex items-center justify-center gap-2 text-slate-700">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading messages…
              </div>
            ) : msgError ? (
              <div className="bg-white rounded-2xl border border-red-100 p-6 text-center">
                <p className="text-sm font-semibold text-[#D32F2F]">{msgError}</p>
                <button
                  onClick={() => selected && void openConversation(selected)}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#E53935] text-white text-xs font-bold"
                >
                  Retry
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No messages in this conversation yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                {messages.map((m) => {
                  const isBuyer = m.senderId === selected.buyerId;
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 ${isBuyer ? 'justify-start' : 'justify-end'}`}
                    >
                      {isBuyer && (
                        <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center text-xs font-black shrink-0 mt-1">
                          {m.senderName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className={`max-w-[78%] rounded-2xl px-4 py-3 border ${isBuyer ? 'bg-white border-slate-100' : 'bg-[#0F172A] border-[#0F172A] text-white'}`}>
                        <p className={`text-[11px] font-bold ${isBuyer ? 'text-slate-700' : 'text-slate-600'}`}>
                          {m.senderName} · <span className="font-normal">{formatDateTime(m.createdAt)}</span>
                          {m.isRead ? ' · read' : ' · unread'}
                        </p>
                        <p className={`text-sm leading-relaxed mt-1 whitespace-pre-wrap break-words ${isBuyer ? 'text-slate-700' : 'text-white'}`}>{m.message}</p>
                      </div>
                      {!isBuyer && (
                        <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center text-xs font-black shrink-0 mt-1">
                          {m.senderName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelected(null)}
                className="px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
