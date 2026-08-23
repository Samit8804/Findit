'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as XIcon, Link2, Check, Share2 } from 'lucide-react';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);

const XBrandIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ open, onClose, title, url }) => {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      setCanNativeShare(true);
    }
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const shareText = encodeURIComponent(`${title} — found on FindIt`);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setToast('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast('Could not copy link.');
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: `${title} — found on FindIt`, url });
    } catch {
      /* user cancelled */
    }
  };

  const channels = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: WhatsAppIcon,
      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
      href: `https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}`,
    },
    {
      key: 'twitter',
      label: 'Twitter / X',
      icon: XBrandIcon,
      color: 'bg-sky-50 text-sky-700 hover:bg-sky-100',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: FacebookIcon,
      color: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
  ];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#0F172A] flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#E53935]" /> Share this ad
                </h3>
                <button
                  onClick={onClose}
                  aria-label="Close share dialog"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <XIcon className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors mb-3 ${
                  copied
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-3">
                  {copied ? (
                    <Check className="w-4.5 h-4.5 text-emerald-600" />
                  ) : (
                    <Link2 className="w-4.5 h-4.5 text-[#E53935]" />
                  )}
                  <span className="text-sm font-semibold text-[#0F172A]">
                    {copied ? 'Copied!' : 'Copy Link'}
                  </span>
                </span>
                <span className="text-xs text-slate-400 truncate max-w-[140px]">{url}</span>
              </button>

              {/* Social channels */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {channels.map((ch) => (
                  <a
                    key={ch.key}
                    href={ch.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-colors ${ch.color}`}
                  >
                    <ch.icon className="w-5 h-5" />
                    <span className="text-[11px] font-semibold">{ch.label}</span>
                  </a>
                ))}
              </div>

              {/* Native share */}
              {canNativeShare && (
                <button
                  onClick={handleNativeShare}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#E53935] hover:bg-[#D32F2F] transition-colors text-white text-sm font-semibold rounded-xl"
                >
                  <Share2 className="w-4 h-4" /> More options...
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 bg-[#0F172A] text-white text-sm font-semibold rounded-xl shadow-2xl flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-emerald-400" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};