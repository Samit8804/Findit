'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  openOrCreateConversation,
} from '@/services/messaging';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

interface ContactButtonsProps {
  adId: string;
  sellerUserId: string;
  sellerSlug?: string;
  sellerName: string;
  adTitle: string;
  /** Respects the seller's privacy settings — omit when disabled. */
  phone?: string;
  whatsapp?: string;
  /** Subscription gate (free plan / not permitted). */
  messageLocked?: boolean;
  /** Viewer owns this ad — hide messaging entirely. */
  isOwnAd?: boolean;
}

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
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSendMessageClick = async () => {
    // Not logged in → prompt + redirect back after login
    const sb = isSupabaseConfigured ? getSupabaseBrowser() : null;
    if (!sb) {
      setMsgOpen(true);
      return;
    }
    const { data } = await sb.auth.getUser();
    if (!data.user) {
      toast('Login to contact the seller.');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setCreating(true);
    try {
      const convId = await openOrCreateConversation(adId, sellerUserId);
      router.push(`/dashboard/messages?c=${convId}`);
    } catch (e: any) {
      setCreating(false);
      switch (e.message) {
        case 'NOT_AUTHENTICATED':
          toast('Login to contact the seller.');
          break;
        case 'SELF_CONVERSATION':
          toast('This is your own advertisement.');
          break;
        case 'USER_BLOCKED':
          toast('User blocked.');
          break;
        case 'BACKEND_NOT_CONFIGURED':
          toast('Messaging requires Supabase configuration.');
          break;
        default:
          toast(e.message || 'Unable to start conversation.');
      }
    }

    function toast(msg: string) {
      window.dispatchEvent(new CustomEvent('findit-toast', { detail: msg }));
    }
  };

  const sendMessageDemo = () => {
    if (!message.trim()) {
      setError('Please write a message first.');
      return;
    }
    setError('');
    setSent(true);
    setTimeout(() => {
      setMsgOpen(false);
      setSent(false);
      setMessage('');
    }, 1600);
  };

  /* ---------------- Button row ---------------- */
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

  const msgBtn = isOwnAd ? (
    <span className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-default">
      Your Ad
    </span>
  ) : messageLocked ? (
    <a
      href="/pricing"
      title="Messaging requires a Business plan"
      className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#0F172A] text-sm font-bold transition-colors"
    >
      <Lock className="w-4 h-4" /> Message
    </a>
  ) : (
    <button
      onClick={handleSendMessageClick}
      disabled={creating}
      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-sm font-semibold transition-colors"
    >
      {creating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> Opening…
        </>
      ) : (
        <>
          <Send className="w-4 h-4" /> Message
        </>
      )}
    </button>
  );

  const buttons = [callBtn, waBtn, msgBtn].filter(Boolean);

  return (
    <>
      <div className={`grid gap-3 ${buttons.length === 3 ? 'grid-cols-3' : buttons.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {buttons}
      </div>

      {/* Demo-mode modal (no backend configured) */}
      <AnimatePresence>
        {msgOpen && !isSupabaseConfigured && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setMsgOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {sent ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-[#0F172A]">Message Sent!</h3>
                  <p className="text-xs text-slate-500 mt-1">{sellerName} will reply soon.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#0F172A]">Message {sellerName}</h3>
                    <button onClick={() => setMsgOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <label htmlFor="seller-msg" className="block text-xs font-semibold text-slate-500 mb-1.5">Your message</label>
                  <textarea
                    id="seller-msg"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent resize-none ${error ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  />
                  {error && <p role="alert" className="text-xs text-red-600 font-medium mt-1.5">{error}</p>}
                  <button onClick={sendMessageDemo} className="w-full mt-4 py-3 bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" /> Send Message
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast listener (loose coupling with page toasts) */}
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