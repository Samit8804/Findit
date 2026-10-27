'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Feedback';
import { Clock, Check, X as XIcon, Loader2, MessageCircle, Lock, ArrowRight } from 'lucide-react';

interface ConnectionRequestRow {
  id: string;
  senderId: string;
  recipientId: string;
  listingId: string | null;
  initialMessage: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  listingTitle?: string;
  senderName?: string;
  senderAvatar?: string;
}

export default function ConnectionRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ConnectionRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    (async () => {
      const sb = getSupabaseBrowser();
      if (!sb) { setLoading(false); return; }
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { setLoading(false); return; }
      setMyId(auth.user.id);
      try {
        const { data, error } = await sb
          .from('connection_requests')
          .select(`
            *,
            ads(title),
            sender:profiles!connection_requests_sender_id_fkey(id, name, avatar_url)
          `)
          .eq('recipient_id', auth.user.id)
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        setRequests((data || []).map((r: any) => ({
          id: r.id,
          senderId: r.sender_id,
          recipientId: r.recipient_id,
          listingId: r.listing_id,
          initialMessage: r.initial_message,
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          respondedAt: r.responded_at,
          listingTitle: r.ads?.title,
          senderName: r.sender?.name,
          senderAvatar: r.sender?.avatar_url,
        })));
      } catch (e: any) {
        toast(e.message || 'Failed to load requests.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const respond = async (requestId: string, action: 'accept' | 'decline') => {
    setResponding(requestId);
    try {
      const res = await fetch('/api/connection-requests/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await getSupabaseBrowser()!.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ request_id: requestId, action }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to respond');
      setRequests((rs) => rs.map((r) => r.id === requestId ? { ...r, status: action === 'accept' ? 'accepted' : 'declined', respondedAt: new Date().toISOString() } : r));

      if (action === 'accept' && result.conversationId) {
        toast('Request accepted. Opening chat…');
        router.push(`/dashboard/messages?c=${result.conversationId}`);
        return;
      }

      toast(`Request ${action}ed.`);
    } catch (e: any) {
      toast(e.message || 'Failed to respond to request.');
    } finally {
      setResponding(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const others = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <main className="flex-grow py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-black tracking-tight">Connection Requests</h1>
            <p className="text-sm text-slate-500 mt-1">People who want to connect with you directly or about a listing.</p>
          </div>

          {/* Pending requests */}
          {pending.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-black tracking-widest text-slate-400 uppercase mb-4">Pending Requests</h2>
              <div className="space-y-3">
                {pending.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center text-sm font-black shrink-0">
                        {r.senderName?.charAt(0) || '?'}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-bold truncate">{r.senderName || 'A buyer'}</p>
                        <p className="text-xs text-slate-500">
                          {r.listingId
                            ? <>Interested in: <span className="font-semibold">{r.listingTitle || 'a listing'}</span></>
                            : 'Direct connection request'}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4 italic">"{r.initialMessage}"</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respond(r.id, 'accept')}
                        disabled={responding === r.id}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-70"
                      >
                        {responding === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Accept
                      </button>
                      <button
                        onClick={() => respond(r.id, 'decline')}
                        disabled={responding === r.id}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:border-[#E53935] hover:text-[#E53935] text-sm font-bold transition-colors disabled:opacity-70"
                      >
                        <XIcon className="w-4 h-4" /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Accepted/Declined history */}
          {others.length > 0 && (
            <section>
              <h2 className="text-sm font-black tracking-widest text-slate-400 uppercase mb-4">History</h2>
              <div className="space-y-3">
                {others.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">
                        {r.senderName?.charAt(0) || '?'}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-semibold truncate">{r.senderName || 'A buyer'}</p>
                        <p className="text-xs text-slate-500">{r.listingId ? r.listingTitle || 'a listing' : 'Direct connection'}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        r.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {r.status === 'accepted' ? <Check className="w-3 h-3 mr-1" /> : <XIcon className="w-3 h-3 mr-1" />}{r.status}
                      </span>
                    </div>
                    {r.status === 'accepted' && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-500 mb-2">
                          {r.listingId
                            ? 'Request accepted. Buyer can message if they have an active messaging subscription.'
                            : 'Request accepted. You can now message each other directly.'}
                        </p>
                        <Link
                          href={`/dashboard/messages`}
                          className="text-xs text-[#E53935] font-semibold hover:underline flex items-center gap-1"
                        >
                          <ArrowRight className="w-3 h-3" /> View Messages
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {requests.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-slate-600 mb-2">No connection requests yet.</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">When a buyer sends you a connection request, it will appear here.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
