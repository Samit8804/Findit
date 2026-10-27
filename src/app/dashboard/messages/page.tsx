'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Paperclip,
  SendHorizonal,
  Search,
  Flag,
  ChevronRight,
  Check,
  CheckCheck,
  Loader2,
  UserRound,
  MapPin,
} from 'lucide-react';
import {
  listConversations,
  getMessages,
  sendMessage,
  markConversationRead,
  subscribeToConversation,
  subscribeToMyConversations,
  blockUser,
  reportMessage,
  getOrCreateDirectConversation,
  ConversationSummary,
  ChatMessage,
} from '@/services/messaging';
import {
  searchUsersByUsername,
  sendDirectConnectionRequest,
  respondToConnectionRequest,
} from '@/services/connectionRequests';
import type { SearchUserResult } from '@/services/connectionRequests';
import { isSupabaseConfigured, getSupabaseBrowser } from '@/lib/supabase/client';
import { useMessagingAccess } from '@/lib/useMessagingAccess';
import { canBuyerSendMessage, formatMessagingExpiry } from '@/lib/messagingEntitlement';
import { useUnread } from '@/components/providers/UnreadProvider';

const QUICK_REPLIES = [
  'Is this still available?',
  'Is the price negotiable?',
  'Can you provide more details?',
  'Where can I see this item?',
];

const REPORT_REASONS = ['Spam', 'Scam', 'Harassment', 'Inappropriate behavior', 'Other'];

function directChatErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('USER_BLOCKED')) return 'You cannot message this user.';
  if (message.includes('NO_ACCEPTED_CONNECTION')) return 'Accept the connection request before messaging.';
  if (message.includes('USER_NOT_FOUND')) return 'User not found.';
  if (message.includes('SELF_CONNECTION')) return 'You cannot message yourself.';
  if (message.includes('NOT_AUTHENTICATED')) return 'Sign in to open this chat.';
  if (message.includes('BACKEND_NOT_CONFIGURED')) return 'Messaging is not configured.';
  return message ? message.replaceAll('_', ' ') : 'Unable to open this conversation.';
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const unread = useUnread();
  const refreshUnread = unread.refresh;
  const { access, loading: accessLoading, refresh: refreshAccess } = useMessagingAccess();

  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState('');
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [toast, setToast] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }, []);

  /* ---------------- load conversations ---------------- */
  const loadConversations = useCallback(async (
    options?: { preferredId?: string }
  ): Promise<ConversationSummary[]> => {
    if (!isSupabaseConfigured) { setListLoading(false); return []; }
    try {
      const list = await listConversations();
      setConvs(list);
      setLoadError('');
      setActiveId((cur) => {
        if (options?.preferredId) return options.preferredId;
        if (cur && list.some((c) => c.id === cur)) return cur;
        return list[0]?.id || '';
      });
      return list;
    } catch {
      setLoadError('Failed to load messages.');
      return [];
    } finally {
      setListLoading(false);
    }
  }, []);

  const openConversation = useCallback((conversationId: string) => {
    setBlocked(false);
    setActiveId(conversationId);
    setMobileChatOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set('c', conversationId);
    router.replace(`/dashboard/messages?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const deepLink = searchParams.get('c') || undefined;
    void loadConversations({ preferredId: deepLink });
    const sb = getSupabaseBrowser();
    let unsub: (() => void) | undefined;
    sb?.auth.getUser().then(({ data }) => {
      if (data.user) unsub = subscribeToMyConversations(data.user.id, () => void loadConversations());
    });
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const query = userSearch.trim().replace(/^@/, '');
    if (query.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setUserSearchLoading(true);
      setUserSearchError('');
      try {
        const results = await searchUsersByUsername(query);
        if (!cancelled) setSearchResults(results);
      } catch (error) {
        if (!cancelled) {
          setSearchResults([]);
          setUserSearchError(error instanceof Error ? error.message : 'USER_SEARCH_FAILED');
        }
      } finally {
        if (!cancelled) setUserSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userSearch]);

  const active = useMemo(
    () => convs.find((c) => c.id === activeId) || (activeId ? undefined : convs[0]),
    [convs, activeId]
  );

  const canSend = active ? active.isDirect || canBuyerSendMessage(access, active.role) : false;
  const expiry = formatMessagingExpiry(access?.expiresAt);

  const filtered = convs.filter(
    (c) =>
      c.otherName.toLowerCase().includes(search.toLowerCase()) ||
    c.adTitle.toLowerCase().includes(search.toLowerCase()) ||
    (c.isDirect && 'direct connection'.includes(search.toLowerCase()))
  );

  /* ---------------- load messages + realtime + read ---------------- */
  useEffect(() => {
    if (!active?.id || !isSupabaseConfigured) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    setMsgsLoading(true);
    getMessages(active.id)
      .then((m) => { if (!cancelled) setMessages(m); })
      .catch(() => !cancelled && setLoadError('Failed to load messages.'))
      .finally(() => { if (!cancelled) setMsgsLoading(false); });

    void markConversationRead(active.id).then(refreshUnread);

    unsubscribe = subscribeToConversation(active.id, () => {
      getMessages(active.id).then((m) => { if (!cancelled) setMessages(m); });
      void markConversationRead(active.id).then(refreshUnread);
      void loadConversations();
    });

    return () => { cancelled = true; unsubscribe?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  /* scroll to bottom on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (text: string) => {
    if (!active || blocked) return;
    if (!canSend) {
      flash('Your messaging plan is not active. Choose a plan that includes messaging.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage(active.id, trimmed);
      setDrafts((d) => ({ ...d, [active.id]: '' }));
      setMessages(await getMessages(active.id));
    } catch (e: any) {
      const message = e.message || 'Failed to send message.';
      if (/messaging subscription|subscription required|expired/i.test(message)) {
        flash('Your messaging plan is not active. Renew it to send new messages.');
        refreshAccess();
      } else {
        flash(message === 'User blocked' ? 'You can no longer message this user.' : message);
      }
    } finally {
      setSending(false);
    }
  };

  const requestConnection = async (userId: string) => {
    setSendingRequestTo(userId);
    try {
      const requestId = await sendDirectConnectionRequest(userId);
      setSearchResults((results) =>
        results.map((user) =>
          user.id === userId
            ? { ...user, connectionStatus: 'sent', requestId }
            : user
        )
      );
      flash('Connection request sent.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'REQUEST_FAILED';
      if (message.includes('ALREADY_CONNECTED')) {
        setSearchResults((results) =>
          results.map((user) => user.id === userId ? { ...user, connectionStatus: 'connected' } : user)
        );
      } else if (message.includes('REQUEST_ALREADY_SENT')) {
        setSearchResults((results) =>
          results.map((user) => user.id === userId ? { ...user, connectionStatus: 'sent' } : user)
        );
      } else if (message.includes('INCOMING_REQUEST_EXISTS')) {
        try {
          setSearchResults(await searchUsersByUsername(userSearch.trim().replace(/^@/, '')));
        } catch {
          flash('A request is already waiting. Refresh the search to respond.');
        }
      }
      flash(message.toLowerCase().includes('blocked')
        ? 'You cannot connect with this user.'
        : message.replaceAll('_', ' '));
    } finally {
      setSendingRequestTo(null);
    }
  };

  const respondToSearchRequest = async (user: SearchUserResult, action: 'accept' | 'decline') => {
    if (!user.requestId) return;
    setRespondingTo(user.id);
    try {
      const updated = await respondToConnectionRequest(user.requestId, action);

      setSearchResults((results) =>
        results.map((entry) =>
          entry.id === user.id
            ? {
                ...entry,
                connectionStatus: action === 'accept' ? 'connected' : 'none',
                requestId: undefined,
              }
            : entry
        )
      );

      if (action === 'accept') {
        const conversationId = updated.conversationId;
        if (conversationId) {
          await loadConversations({ preferredId: conversationId });
          openConversation(conversationId);
          flash('Request accepted. Chat opened.');
        } else {
          await loadConversations();
          flash('Request accepted. You can now message each other.');
        }
      } else {
        flash('Request declined.');
      }
    } catch (error) {
      flash(directChatErrorMessage(error));
    } finally {
      setRespondingTo(null);
    }
  };

  const openDirectChat = async (userId: string) => {
    try {
      // Idempotent database operation: creates the pair's direct
      // conversation (ad_id = NULL) if it does not exist yet.
      const conversationId = await getOrCreateDirectConversation(userId);
      await loadConversations({ preferredId: conversationId });
      openConversation(conversationId);
    } catch (error) {
      flash(directChatErrorMessage(error));
    }
  };

  const handleBlock = async () => {
    if (!active) return;
    if (!window.confirm(`Block ${active.otherName}? They will not be able to message you.`)) return;
    try {
      await blockUser(active.otherUserId);
      setBlocked(true);
      flash('User blocked.');
    } catch {
      flash('Unable to block user.');
    }
  };

  const handleReport = async () => {
    if (!active) return;
    try {
      const last = [...messages].reverse().find((m) => !m.mine);
      await reportMessage(last?.id ?? null, reportReason);
      setReportOpen(false);
      flash('Report submitted. Our team will review it.');
    } catch {
      flash('Failed to submit report.');
    }
  };

  /* ---------------- render ---------------- */
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Messages</h1>
          <p className="text-xs text-slate-500 mt-1">Chat with buyers and sellers in real time.</p>
        </div>
        {!accessLoading && access?.allowed && (
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {access.configured === false
              ? 'Demo preview — simulated messaging'
              : `${access.planName || 'Messaging'} active${expiry ? ` · until ${expiry}` : ''}`}
          </span>
        )}
      </div>

      {loadError && (
        <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl text-sm font-semibold text-[#D32F2F] flex items-center justify-between">
          {loadError}
          <button onClick={() => void loadConversations()} className="px-4 py-2 rounded-lg bg-[#E53935] text-white text-xs font-bold">Retry</button>
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3">
          <h2 className="text-base font-black">Find people</h2>
          <p className="mt-1 text-xs text-slate-500">Search by username to connect and message directly.</p>
        </div>
        <label htmlFor="user-search" className="sr-only">Search users by username</label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="user-search"
            value={userSearch}
            onChange={(event) => {
              const value = event.target.value;
              setUserSearch(value);
              setSearchResults([]);
              setUserSearchError('');
              setUserSearchLoading(value.trim().replace(/^@/, '').length >= 2);
            }}
            placeholder="Enter a username..."
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
          />
        </div>
        {userSearch.length > 0 && userSearch.trim().replace(/^@/, '').length < 2 && (
          <p className="mt-2 text-xs text-slate-400">Enter at least 2 characters.</p>
        )}
        {userSearchLoading && (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching usernames…
          </div>
        )}
        {userSearchError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">
            {userSearchError.replaceAll('_', ' ')}
          </p>
        )}
        {!userSearchLoading && userSearch.trim().replace(/^@/, '').length >= 2 && !userSearchError && (
          searchResults.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {searchResults.map((user) => (
                <li key={user.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-50 text-sm font-black text-[#E53935]">
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{user.displayName || user.username}</span>
                      <span className="block truncate text-xs text-slate-500">
                        @{user.username}{user.accountType === 'business' ? ' · Business' : ''}
                      </span>
                      {user.location && (
                        <span className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400">
                          <MapPin className="h-3 w-3 shrink-0" /> {user.location}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {user.connectionStatus === 'none' && (
                      <button
                        onClick={() => void requestConnection(user.id)}
                        disabled={sendingRequestTo === user.id}
                        className="w-full rounded-xl bg-[#E53935] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#D32F2F] disabled:opacity-60 sm:w-auto"
                      >
                        {sendingRequestTo === user.id ? <Loader2 className="inline h-4 w-4 animate-spin" /> : 'Request to Connect'}
                      </button>
                    )}
                    {user.connectionStatus === 'sent' && (
                      <span className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-500">Request Sent</span>
                    )}
                    {user.connectionStatus === 'incoming' && (
                      <>
                        <button
                          onClick={() => void respondToSearchRequest(user, 'accept')}
                          disabled={respondingTo === user.id}
                          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 sm:flex-none"
                        >
                          {respondingTo === user.id ? <Loader2 className="inline h-4 w-4 animate-spin" /> : 'Accept'}
                        </button>
                        <button
                          onClick={() => void respondToSearchRequest(user, 'decline')}
                          disabled={respondingTo === user.id}
                          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-60 sm:flex-none"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {user.connectionStatus === 'connected' && (
                      <button
                        onClick={() => void openDirectChat(user.id)}
                        className="w-full rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 sm:w-auto"
                      >
                        Connected · Message
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">No users found for that username.</p>
          )
        )}
      </section>

      {accessLoading ? (
        <div className="mb-6 p-8 text-center bg-white rounded-2xl border border-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Checking messaging access…</p>
        </div>
      ) : access && !access.allowed ? (
        <div className="mb-6 p-8 text-center bg-white rounded-2xl border border-slate-100">
          <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-black mb-2">Messaging is locked</h2>
          <p className="text-slate-600 mb-2 max-w-md mx-auto leading-relaxed">
            You can still message accepted direct connections. To message buyers or sellers about a listing,
            choose a plan that includes messaging.
          </p>
          <p className="text-xs text-slate-400 mb-6">Sellers can reply to buyers who are already in a conversation.</p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-lg shadow-red-200"
          >
            <ArrowRight className="w-4 h-4" /> View Plans
          </Link>
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-col lg:grid lg:grid-cols-[320px_1fr] lg:h-[calc(100dvh-12rem)] min-h-[calc(100dvh-12rem)]">
          {/* -------- Conversation list -------- */}
          <aside className={`border-r border-slate-100 flex flex-col lg:flex ${mobileChatOpen ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  aria-label="Search conversations"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                />
              </div>
            </div>

            <ul className="flex-grow overflow-y-auto divide-y divide-slate-50">
              {listLoading ? (
                [...Array(4)].map((_, i) => (
                  <li key={i} className="p-4 animate-pulse flex gap-3">
                    <div className="w-11 h-11 rounded-full bg-slate-200 shrink-0" />
                    <div className="flex-grow space-y-2"><div className="h-4 w-1/2 bg-slate-200 rounded" /><div className="h-3 w-3/4 bg-slate-200 rounded" /></div>
                  </li>
                ))
              ) : filtered.length === 0 ? (
                <li className="p-8 text-center">
                  <p className="text-sm font-semibold text-slate-600">No conversations yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Search for a username or contact a seller to start a conversation.</p>
                </li>
              ) : (
                filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => { setBlocked(false); setActiveId(c.id); setMobileChatOpen(true); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${c.id === active?.id ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}
                    >
                      <span className="relative shrink-0">
                        <span className="w-11 h-11 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center text-xs font-black overflow-hidden">
                          {c.otherAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.otherAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            c.otherName.charAt(0)
                          )}
                        </span>
                      </span>
                      <span className="min-w-0 flex-grow">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold truncate">{c.otherName}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{c.lastTime}</span>
                        </span>
                        <span className="block text-[11px] text-slate-400 truncate mt-0.5">{c.lastMessage || (c.isDirect ? 'Direct connection' : `Re: ${c.adTitle}`)}</span>
                        <span className="block text-[10px] font-semibold text-[#E53935]/80 truncate mt-0.5">{c.isDirect ? 'Direct connection' : `Re: ${c.adTitle}`}</span>
                      </span>
                      {c.unread > 0 && (
                        <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#E53935] text-white text-[10px] font-bold flex items-center justify-center">{c.unread}</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>

          {/* -------- Active conversation -------- */}
          <section className="flex flex-col lg:flex lg:flex-1 min-w-0" aria-label="Active conversation">
            {!active ? (
              <div className="flex-grow flex items-center justify-center text-sm text-slate-400">
                Select a conversation to start chatting.
              </div>
            ) : (
              <>
                {/* header */}
                <header className="flex items-center gap-3 p-4 border-b border-slate-100">
                  <button onClick={() => setMobileChatOpen(false)} className="md:hidden p-2 -ml-1 rounded-lg hover:bg-slate-100" aria-label="Back to conversations">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <span className="w-10 h-10 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center text-xs font-black overflow-hidden shrink-0">
                    {active.otherAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={active.otherAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      active.otherName.charAt(0)
                    )}
                  </span>
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-bold truncate">{active.otherName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{active.isDirect ? 'Direct connection' : `Re: ${active.adTitle}`}</p>
                  </div>
                  <button
                    onClick={() => setReportOpen(true)}
                    title="Report / Block"
                    className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-400 transition-colors"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </header>

                {/* Ad reference */}
                {active.isDirect ? (
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                    <UserRound className="h-5 w-5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Direct connection</span>
                  </div>
                ) : (
                  <Link href={`/ad/${active.adSlug}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
                    {active.adImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={active.adImage} alt="" className="w-9 h-9 rounded-lg object-cover" />
                    )}
                    <span className="min-w-0 flex-grow">
                      <span className="block text-xs font-bold truncate">{active.adTitle}</span>
                      <span className="block text-[10px] text-slate-400">
                        {active.adPrice != null ? `₹${active.adPrice.toLocaleString('en-IN')}` : ''}
                        {(active.adStatus === 'sold') && <span className="ml-2 font-black text-sky-600">SOLD</span>}
                        {(active.adStatus === 'expired') && <span className="ml-2 font-black text-slate-400">EXPIRED</span>}
                        {(active.adStatus === 'deleted') && <span className="ml-2 font-black text-slate-400">This advertisement is no longer available.</span>}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </Link>
                )}

                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                  {msgsLoading ? (
                    <div className="animate-pulse space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className={`flex ${i % 2 ? 'justify-end' : ''}`}>
                          <div className={`h-10 w-2/3 rounded-2xl ${i % 2 ? 'bg-red-200/60' : 'bg-slate-200'}`} />
                        </div>
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center pt-10">
                      <p className="text-sm font-semibold text-slate-500 mb-4">
                        {canSend ? 'Start the conversation.' : 'No messages yet.'}
                      </p>
                      {canSend ? (
                        <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                          {QUICK_REPLIES.map((qr) => (
                            <button
                              key={qr}
                              onClick={() => void send(qr)}
                              className="px-3.5 py-2 rounded-full border border-slate-200 bg-white hover:border-[#E53935] hover:text-[#E53935] text-xs font-semibold transition-colors"
                            >
                              {qr}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                          {active.role === 'buyer'
                            ? 'An active messaging plan is required to reply. You can still read the history.'
                            : 'Waiting for the buyer to send a message.'}
                        </p>
                      )}
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.mine ? 'bg-[#E53935] text-white rounded-br-md' : 'bg-white border border-slate-100 text-slate-700 rounded-bl-md shadow-xs'}`}>
                          <p>{m.message}</p>
                          <p className={`text-[10px] mt-1 flex items-center gap-1 ${m.mine ? 'text-white/70 justify-end' : 'text-slate-400'}`}>
                            {m.time} {m.mine && (m.isRead ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <footer className="p-4 border-t border-slate-100">
                  {blocked ? (
                    <p className="text-center text-xs font-semibold text-slate-400 py-3 bg-slate-50 rounded-xl">User blocked</p>
                  ) : !active.isDirect && active.role === 'buyer' && accessLoading ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking your messaging plan…
                    </div>
                  ) : !canSend ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-center">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-xs font-semibold text-amber-800">
                        Your messaging plan is not active. Renew a messaging plan to reply.
                      </p>
                      <Link href="/pricing" className="text-xs font-bold text-[#E53935] hover:underline">
                        View plans
                      </Link>
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); const el = document.getElementById('chat-input') as HTMLInputElement; void send(el.value); if (el) el.value = ''; }} className="flex items-center gap-2">
                      <button type="button" className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 shrink-0" aria-label="Attach a file">
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <label htmlFor="chat-input" className="sr-only">Type a message</label>
                      <input
                        id="chat-input"
                        placeholder="Type your message..."
                        autoComplete="off"
                        maxLength={2000}
                        onChange={(e) => setDrafts((d) => ({ ...d, [active.id]: e.target.value }))}
                        value={drafts[active.id] || ''}
                        className="flex-grow px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                      />
                      <button type="submit" disabled={sending || !(drafts[active.id] || '').trim()} aria-label="Send message" className="p-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-40 text-white shrink-0 transition-colors">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                      </button>
                    </form>
                  )}
                </footer>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Report modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setReportOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-4">Report this conversation</h3>
            <fieldset className="space-y-2 mb-5">
              {REPORT_REASONS.map((r) => (
                <label key={r} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer text-sm transition-colors ${reportReason === r ? 'border-[#E53935] bg-red-50 text-[#E53935] font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <input type="radio" name="report-reason-msg" checked={reportReason === r} onChange={() => setReportReason(r)} className="accent-[#E53935]" />
                  {r}
                </label>
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => void handleReport()} className="py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-bold transition-colors">Submit Report</button>
              <button onClick={() => void handleBlock()} className="py-2.5 rounded-xl border border-slate-200 hover:border-[#E53935] hover:text-[#E53935] text-xs font-bold transition-colors">Block User</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 bg-[#0F172A] text-white text-sm font-semibold rounded-xl shadow-2xl" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-400">Loading...</div>}>
      <MessagesContent />
    </Suspense>
  );
}