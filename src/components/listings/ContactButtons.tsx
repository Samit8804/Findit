'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageCircle, X as XIcon, Check, Send } from 'lucide-react';

interface ContactButtonsProps {
  phone?: string;
  sellerName: string;
  adTitle: string;
}

export const ContactButtons: React.FC<ContactButtonsProps> = ({
  phone = '+91 98765 43210',
  sellerName,
  adTitle,
}) => {
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState(`Hi, I'm interested in "${adTitle}". Is it still available?`);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const sendMessage = () => {
    if (!message.trim()) {
      setError('Please write a message first.');
      return;
    }
    setError('');
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTimeout(() => {
        setMsgOpen(false);
        setSent(false);
        setMessage('');
      }, 1600);
    }, 900);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <a
          href={`tel:${phone.replace(/\s/g, '')}`}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
        >
          <Phone className="w-4 h-4" /> Call
        </a>
        <a
          href={`https://api.whatsapp.com/send?phone=${phone.replace(/[\s+]/g, '')}&text=${encodeURIComponent(`Hi, I'm interested in "${adTitle}"`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
        <button
          onClick={() => setMsgOpen(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-semibold transition-colors"
        >
          <Send className="w-4 h-4" /> Message
        </button>
      </div>

      <AnimatePresence>
        {msgOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !sending && setMsgOpen(false)}
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
                  <p className="text-xs text-slate-500 mt-1">{sellerName} will reply to your message soon.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#0F172A]">Message {sellerName}</h3>
                    <button
                      onClick={() => setMsgOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                      aria-label="Close"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <label htmlFor="seller-msg" className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Your message
                  </label>
                  <textarea
                    id="seller-msg"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={500}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent resize-none ${
                      error ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                  {error && <p className="text-xs text-red-600 mt-1.5 font-medium">{error}</p>}
                  <p className="text-xs text-slate-400 mt-1 mb-4">{message.length}/500</p>
                  <button
                    onClick={sendMessage}
                    disabled={sending}
                    className="w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Send Message
                      </>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};