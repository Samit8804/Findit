'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  MessageCircle,
  X as XIcon,
  Check,
  Send,
  Lock,
  Loader2,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { openOrCreateConversation } from '@/services/messaging';
import {
  sendConnectionRequest,
  listConnectionRequests,
  respondToConnectionRequest,
  cancelConnectionRequest,
  type ConnectionRequest,
} from '@/services/connectionRequests';
import { hasActiveMessagingSubscription } from '@/services/profile';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Feedback';

interface ContactButtonsProps {
  adId: string;
  sellerUserId: string;
  sellerSlug?: string;
  sellerName: string;
  adTitle: string;
  phone?: string;
  whatsapp?: string;
  messageLocked?: boolean;
  isOwnAd?: boolean;
}

type RequestStatus = 'none' | 'pending' | 'accepted' | 'declined' | 'cancelled';

export const ContactButtons: React.FC<ContactButtonsProps> = ({
  adId,
  sellerUserId,
  sellerSlug,
  sellerName,
  adTitle,
  phone,
  whatsapp,
  messageLocked = false,
  isOwnAd = false,
}) => {
  const router = useRouter();
  const toast = useToast();
  const [reqStatus, setReqStatus] = useState<RequestStatus>('none');
  const [request, setRequest] = useState<ConnectionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgOpen, setMsgOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    if (isOwnAd) { setLoading(false); return; }
    (async () => {
      const sb = getSupabaseBrowser();
      if (!sb) { setLoading(false); return; }
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) { setLoading(false); return; }
      setMyId(auth.user.id);

      // Check subscription
      const sub = await hasActiveMessagingSubscription(auth.user.id);
      setHasSubscription(sub);

      // Load existing requests
      try {
        const { data, error } = await sb
          .from('connection_requests')
          .select('*')
          .eq('listing_id', adId)
          .or(`and(sender_id.eq.${auth.user.id},recipient_id.eq.${sellerUserId}),and(sender_id.eq.${sellerUserId},recipient_id.eq.${auth.user.id})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setRequest(data);
          setReqStatus(data.status as RequestStatus);
        } else {
          setReqStatus('none');
        }
      } catch {
        setReqStatus('none');
      } finally {
        setLoading(false);
      }
    })();
  }, [adId, sellerUserId, isOwnAd]);

  const handleRequestClick = async () => {
    const sb = isSupabaseConfigured ? getSupabaseBrowser() : null;
    if (!sb) {
      setMsgOpen(true);
      return;
    }
    const { data } = await sb.auth.getUser();
    if (!data.user) {
      window.dispatchEvent(new CustomEvent('findit-toast', { detail: 'Login to send a connection request.' }));
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setMsgOpen(true);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialMessage.trim()) { setError('Please write an introduction.'); return; }
    if (initialMessage.trim().length > 500) { setError('Maximum 500 characters.'); return; }
    setSending(true);
    setError('');
    try {
      const cr = await sendConnectionRequest(adId, sellerUserId, initialMessage.trim());
      setRequest(cr);
      setReqStatus('pending');
      setMsgOpen(false);
      setInitialMessage('');
      window.dispatchEvent(new CustomEvent('findit-toast', { detail: 'Connection request sent.' }));
    } catch (err: any) {
      setSending(false);
      setError(err.message || 'Failed to send request.');
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (action: 'accept' | 'decline') => {
    if (!request) return;
    setResponding(request.id);
    try {
      const updated = await respondToConnectionRequest(request.id, action);
      setRequest(updated);
      setReqStatus(updated.status as RequestStatus);
      window.dispatchEvent(new CustomEvent('findit-toast', { detail: `Request ${action}ed.` }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('findit-toast', { detail: err.message || 'Failed to respond.' }));
    } finally {
      setResponding(null);
    }
  };

  const handleCancel = async () => {
    if (!request) return;
    try {
      await cancelConnectionRequest(request.id);
      setReqStatus('none');
      setRequest(null);
      window.dispatchEvent(new CustomEvent('findit-toast', { detail: 'Request cancelled.' }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('findit-toast', { detail: err.message || 'Failed to cancel.' }));
    }
  };

  const handleStartConversation = async () => {
    if (!myId) return;
    try {
      const convId = await openOrCreateConversation(adId, sellerUserId);
      router.push(`/dashboard/messages?c=${convId}`);
    } catch (err: any) {
      if (err.message === 'MESSAGING_LOCKED') {
        // Fall through to show unlock UI
      } else {
        window.dispatchEvent(new CustomEvent('findit-toast', { detail: err.message || 'Unable to start conversation.' }));
      }
    }
  };

  /* ---------------- Button row (call / WhatsApp) ---------------- */
  const callBtn =
    phone !== undefined && phone !== '' ? (
      <a
        href={`tel:${phone.replace(/\s/g, '')}`}
        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
      >
        <Phone className="w-4 h-4" /> Call
      </a>
    ) : null;

  const waBtn =
    whatsapp !== undefined && whatsapp !== '' ? (
      <a
        href={`https://api.whatsapp.com/send?phone=${whatsapp.replace(/[\s+]/g, '')}&text=${encodeURIComponent(`Hi, I'm interested in "${adTitle}"`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
      >
        <MessageCircle className="w-4 h-4" /> WhatsApp
      </a>
    ) : null;

  /* ---------------- Messaging button / state ---------------- */
  let msgBtn: React.ReactNode;

  if (isOwnAd) {
    msgBtn = (
      <span className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-default">
        Your Ad
      </span>
    );
  } else if (loading) {
    msgBtn = (
      <button disabled className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-200 text-slate-400 text-sm font-semibold">
        <Loader2 className="w-4 h-4 animate-spin" />
      </button>
    );
  } else if (reqStatus === 'none') {
    msgBtn = (
      <button
        onClick={handleRequestClick}
        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-semibold transition-colors"
      >
        <MessageCircle className="w-4 h-4" /> Request to Connect
      </button>
    );
  } else if (reqStatus === 'pending') {
    msgBtn = (
      <button disabled className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-200 text-slate-400 text-sm font-semibold">
        <Clock className="w-4 h-4" /> Request Sent
      </button>
    );
  } else if (reqStatus === 'declined') {
    msgBtn = (
      <button
        onClick={handleRequestClick}
        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 text-sm font-semibold transition-colors"
      >
        <RefreshCw className="w-4 h-4" /> Request Again
      </button>
    );
  } else if (reqStatus === 'accepted') {
    if (hasSubscription === true) {
      msgBtn = (
        <button
          onClick={handleStartConversation}
          disabled={sending}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-sm font-semibold transition-colors"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Opening…
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4" /> Start Conversation
            </>
          )}
        </button>
      );
    } else if (hasSubscription === false) {
      msgBtn = (
        <button
          onClick={() => router.push('/pricing')}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#0F172A] text-sm font-bold transition-colors"
        >
          <Lock className="w-4 h-4" /> Unlock Messaging
        </button>
      );
    } else {
      msgBtn = (
        <button disabled className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-200 text-slate-400 text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" />
        </button>
      );
    }
  }

  const buttons = [callBtn, waBtn, msgBtn].filter(Boolean);

  return (
    <>
      <div className={`grid gap-3 ${buttons.length === 3 ? 'grid-cols-3' : buttons.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {buttons}
      </div>

      {/* Connection Request Modal */}
      <AnimatePresence>
        {msgOpen && (
          <Modal open={msgOpen} onClose={() => setMsgOpen(false)} title="Request to Connect" size="sm">
            <form onSubmit={handleSendRequest} className="space-y-4">
              <p className="text-sm text-slate-600">
                Introduce yourself to <strong>{sellerName}</strong> about <strong>"{adTitle}"</strong>. This request is free — the seller can accept or decline.
              </p>
              <label htmlFor="conn-msg" className="block text-xs font-semibold text-slate-500 mb-1.5">
                Your introduction
              </label>
              <textarea
                id="conn-msg"
                rows={4}
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                maxLength={500}
                placeholder="Hi, I'm interested in your listing..."
                className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent resize-none ${error ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
              />
              {error && <p role="alert" className="text-xs text-red-600 font-medium mt-1.5">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMsgOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-5 py-2 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors disabled:opacity-70"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Request
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Accept/Decline modal for recipient */}
      <AnimatePresence>
        {reqStatus === 'pending' && request && request.recipientId === myId && (
          <Modal open={true} onClose={() => {}} title="Connection Request" size="sm">
            <p className="text-sm text-slate-600 mb-4">
              {request.senderName || 'A user'} wants to connect about <strong>"{request.listingTitle || adTitle}"</strong>.
            </p>
            <p className="text-sm text-slate-600 mb-6">
              <em>"{request.initialMessage}"</em>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRespond('accept')}
                disabled={responding === request.id}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-70"
              >
                {responding === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept'}
              </button>
              <button
                onClick={() => handleRespond('decline')}
                disabled={responding === request.id}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:border-[#E53935] hover:text-[#E53935] text-sm font-bold transition-colors disabled:opacity-70"
              >
                Decline
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Toast listener */}
      <ToastBridge />
    </>
  );
};

/** Minimal global toast bridge so this component can trigger the app toast. */
function ToastBridge() {
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      const el = document.createElement('div');
      el.textContent = detail;
      el.className =
        'fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 bg-[#0F172A] text-white text-sm font-semibold rounded-xl shadow-2xl';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2600);
    };
    window.addEventListener('findit-toast', handler);
    return () => window.removeEventListener('findit-toast', handler);
  }, []);
  return null;
}