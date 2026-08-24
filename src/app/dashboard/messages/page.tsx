'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Paperclip,
  SendHorizonal,
  Search,
  Phone,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { conversations as seedConversations, Conversation } from '@/data/accountData';
import { getMyProfile, canUseMessaging } from '@/services/profile';

export default function MessagesPage() {
  const [planChecked, setPlanChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [convos, setConvos] = useState<Conversation[]>(seedConversations);
  const [activeId, setActiveId] = useState<string>(seedConversations[0]?.id || '');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [search, setSearch] = useState('');

  /* Subscription gate: free plan cannot access messaging */
  useEffect(() => {
    getMyProfile().then((p) => {
      setHasAccess(p ? canUseMessaging(p.plan) : false);
      setPlanChecked(true);
    });
  }, []);

  const active = convos.find((c) => c.id === activeId) || convos[0];
  const filtered = convos.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.adRef.toLowerCase().includes(search.toLowerCase())
  );

  const openConversation = (id: string) => {
    setActiveId(id);
    setMobileChatOpen(true);
    setConvos((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  };

  const sendMessage = () => {
    const text = (drafts[active.id] || '').trim();
    if (!text) return;
    setConvos((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, messages: [...c.messages, { from: 'me' as const, text, time: 'Just now' }] }
          : c
      )
    );
    setDrafts((d) => ({ ...d, [active.id]: '' }));
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Messages</h1>
        <p className="text-xs text-slate-500 mt-1">Chat with buyers and sellers in real time.</p>
      </div>

      {/* Free-plan gate */}
      {planChecked && !hasAccess ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-[#E53935] mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-1.5">Messaging is a subscription feature</h3>
          <p className="text-sm text-slate-500 max-w-md mb-7 leading-relaxed">
            Upgrade to the <strong>BUSINESS</strong> or <strong>BUSINESS PRO</strong> plan to chat
            with buyers, receive enquiries and close deals faster.
          </p>
          <Link
            href="/pricing"
            className="px-6 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold shadow-lg shadow-red-200 transition-colors"
          >
            View Plans &amp; Pricing
          </Link>
        </div>
      ) : (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[600px]">
          {/* Conversation list */}
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
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openConversation(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      c.id === active?.id ? 'bg-red-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center text-xs font-black">
                        {c.avatarText}
                      </div>
                      {c.online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" aria-label="Online" />}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold truncate">{c.name}</p>
                        <span className="text-[10px] text-slate-400 shrink-0">{c.lastTime}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{c.messages[c.messages.length - 1]?.text}</p>
                      <p className="text-[10px] font-semibold text-[#E53935]/80 truncate mt-0.5">Re: {c.adRef}</p>
                    </div>
                    {c.unread > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#E53935] text-white text-[10px] font-bold flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Active conversation */}
          <section className={`flex flex-col ${mobileChatOpen ? 'flex' : 'hidden md:flex'}`} aria-label="Active conversation">
            {active ? (
              <>
                <header className="flex items-center gap-3 p-4 border-b border-slate-100">
                  <button onClick={() => setMobileChatOpen(false)} className="md:hidden p-2 -ml-1 rounded-lg hover:bg-slate-100" aria-label="Back to conversations">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center text-xs font-black">
                      {active.avatarText}
                    </div>
                    {active.online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-bold flex items-center gap-2">
                      {active.name}
                      {active.online && <span className="text-[10px] font-semibold text-emerald-600">Online</span>}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">Re: {active.adRef}</p>
                  </div>
                  <a href="#" onClick={(e) => e.preventDefault()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Call">
                    <Phone className="w-4 h-4" />
                  </a>
                </header>

                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                  <div className="flex items-center gap-3 mx-auto max-w-sm bg-white rounded-xl border border-slate-100 px-4 py-3">
                    <span className="w-8 h-8 rounded-lg bg-red-50 text-[#E53935] flex items-center justify-center font-black text-xs shrink-0">F</span>
                    <p className="text-xs text-slate-600 truncate">{active.adRef}</p>
                    <ChevronRight className="w-4 h-4 text-slate-300 ml-auto shrink-0" />
                  </div>

                  {active.messages.map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.from === 'me' ? 'bg-[#E53935] text-white rounded-br-md' : 'bg-white border border-slate-100 text-slate-700 rounded-bl-md shadow-xs'}`}>
                        <p>{m.text}</p>
                        <p className={`text-[10px] mt-1 ${m.from === 'me' ? 'text-white/70' : 'text-slate-400'}`}>{m.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Message input */}
                <footer className="p-4 border-t border-slate-100">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => setDrafts((d) => ({ ...d, [active.id]: (d[active.id] || '') + '[attachment] ' }))}
                      className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 shrink-0"
                      aria-label="Attach a file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <label htmlFor="chat-input" className="sr-only">Type a message</label>
                    <input
                      id="chat-input"
                      value={drafts[active.id] || ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [active.id]: e.target.value }))}
                      placeholder="Type your message..."
                      autoComplete="off"
                      className="flex-grow px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={!(drafts[active.id] || '').trim()}
                      aria-label="Send message"
                      className="p-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-40 text-white shrink-0 transition-colors"
                    >
                      <SendHorizonal className="w-4 h-4" />
                    </button>
                  </form>
                </footer>
              </>
            ) : null}
          </section>
        </div>
      </div>
      )}
    </div>
  );
}