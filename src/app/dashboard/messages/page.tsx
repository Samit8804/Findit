'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Paperclip,
  SendHorizonal,
  Search,
  Flag,
  Ban,
  ChevronRight,
  Check,
  CheckCheck,
  Loader2,
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
  ConversationSummary,
  ChatMessage,
} from '@/services/messaging';
import { isSupabaseConfigured, getSupabaseBrowser } from '@/lib/supabase/client';

const QUICK_REPLIES = [
  'Is this still available?',
  'Is the price negotiable?',
  'Can you provide more details?',
  'Where can I see this item?',
];

const REPORT_REASONS = ['Spam', 'Scam', 'Harassment', 'Inappropriate behavior', 'Other'];

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [toast, setToast] = useState('');

  const myIdRef = useRef<string | null>(null);
  const activeIdRef = useRef('');
  activeIdRef.current = activeId;
  const bottomRef = useRef<HTMLDivElement>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }, []);

  /* ---------------- load conversations ---------------- */
  const loadConversations = useCallback(async () => {
    if (!isSupabaseConfigured) { setListLoading(false); return; }
    try {
      const list = await listConversations();
      setConvs(list);
      setLoadError('');
      // restore deep-link conversation
      const want = searchParams.get('c');
      setActiveId((cur) => cur || want || list[0]?.id || '');
    } catch (e: any) {
      setLoadError('Failed to load messages.');
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadConversations();
    const sb = getSupabaseBrowser();
    let unsub: (() => void) | undefined;
    sb?.auth.getUser().then(({ data }) => {
      myIdRef.current = data.user?.id ?? null;
      if (data.user) unsub = subscribeToMyConversations(data.user.id, () => void loadConversations());
    });
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(
    () => convs.find((c) => c.id === activeId) || convs[0],
    [convs, activeId]
  );

  const filtered = convs.filter(
    (c) =>
      c.otherName.toLowerCase().includes(search.toLowerCase()) ||
      c.adTitle.toLowerCase().includes(search.toLowerCase())
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

    void markConversationRead(active.id);

    unsubscribe = subscribeToConversation(active.id, () => {
      getMessages(active.id).then((m) => { if (!cancelled) setMessages(m); });
      void markConversationRead(active.id);
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
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage(active.id, trimmed);
      setDrafts((d) => ({ ...d, [active.id]: '' }));
      setMessages(await getMessages(active.id));
    } catch (e: any) {
      flash(e.message === 'User blocked' ? 'You can no longer message this user.' : e.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleBlock = async () => {
    if (!active) return;
    if (!window.confirm(`Block ${active.otherName}? They will not be able to message you.`)) return;
    try {
      const { getSupabaseBrowser } = await import('@/lib/supabase/client');
      const sb = getSupabaseBrowser()!;
      // find other participant's user id from messages
      const other = messages.find((m) => !m.mine)?.senderId;
      if (!other) return;
      const { blockUser } = await import('@/services/messaging');
      await blockUser(other);
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
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Messages</h1>
        <p className="text-xs text-slate-500 mt-1">Chat with buyers and sellers in real time.</p>
      </div>

      {loadError && (
        <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl text-sm font-semibold text-[#D32F2F] flex items-center justify-between">
          {loadError}
          <button onClick={() => void loadConversations()} className="px-4 py-2 rounded-lg bg-[#E53935] text-white text-xs font-bold">Retry</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[600px]">
          {/* -------- Conversation list -------- */}
          <aside className={`border-r border-slate-100 flex flex-col ${mobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
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
                  <p className="text-xs text-slate-400 mt-1">Contact a seller to start a conversation.</p>
                </li>
              ) : (
                filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => { setActiveId(c.id); setMobileChatOpen(true); }}
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
                        <span className="block text-[11px] text-slate-400 truncate mt-0.5">{c.lastMessage || `Re: ${c.adTitle}`}</span>
                        <span className="block text-[10px] font-semibold text-[#E53935]/80 truncate mt-0.5">Re: {c.adTitle}</span>
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
          <section className={`flex flex-col ${mobileChatOpen ? 'flex' : 'hidden md:flex'}`} aria-label="Active conversation">
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
                    <p className="text-[11px] text-slate-400 truncate">Re: {active.adTitle}</p>
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
                      <p className="text-sm font-semibold text-slate-500 mb-4">Start the conversation.</p>
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