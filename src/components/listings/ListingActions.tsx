'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Flag } from 'lucide-react';
import { X as XIcon, Check } from 'lucide-react';

export function FavouriteButton({
  variant = 'floating',
}: {
  variant?: 'floating' | 'button';
}) {
  const [active, setActive] = useState(false);

  if (variant === 'button') {
    return (
      <button
        onClick={() => setActive(!active)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
          active
            ? 'bg-red-50 border-[#E53935] text-[#E53935]'
            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
        }`}
      >
        <motion.span
          key={active ? 'on' : 'off'}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        >
          <Heart className={`w-4 h-4 ${active ? 'fill-current' : ''}`} />
        </motion.span>
        {active ? 'Saved' : 'Save Ad'}
      </button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        e.preventDefault();
        setActive(!active);
      }}
      className={`p-2 rounded-full backdrop-blur-md transition-colors ${
        active ? 'bg-red-500 text-white' : 'bg-white/80 text-slate-700 hover:bg-white'
      }`}
      aria-label="Toggle favourite"
    >
      <Heart className={`w-4 h-4 ${active ? 'fill-current' : ''}`} />
    </motion.button>
  );
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Sold item or unavailable',
  'Wrong category',
  'Offensive content',
  'Scam or fraud',
  'Other',
];

export function ReportButton() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = () => {
    if (!reason) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setReason('');
      }, 1800);
    }, 900);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500 hover:border-red-200 hover:text-[#E53935] transition-colors"
      >
        <Flag className="w-4 h-4" /> Report
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !sending && setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {submitted ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-[#0F172A]">Report Received</h3>
                  <p className="text-xs text-slate-500 mt-1">Our moderation team will review this ad shortly.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#0F172A]">Report this ad</h3>
                    <button
                      onClick={() => setOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                      aria-label="Close"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <fieldset className="space-y-2 mb-5">
                    <legend className="sr-only">Select a reason</legend>
                    {REPORT_REASONS.map((r) => (
                      <label
                        key={r}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer text-sm transition-colors ${
                          reason === r ? 'border-[#E53935] bg-red-50 text-[#E53935] font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          value={r}
                          checked={reason === r}
                          onChange={() => setReason(r)}
                          className="accent-[#E53935]"
                        />
                        {r}
                      </label>
                    ))}
                  </fieldset>
                  <button
                    onClick={submit}
                    disabled={!reason || sending}
                    className="w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {sending ? 'Submitting...' : 'Submit Report'}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}