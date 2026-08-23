'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as XIcon } from 'lucide-react';

/* ---------------- Modal ---------------- */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            className={`bg-white rounded-2xl shadow-2xl w-full ${widths[size]} max-h-[88vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <h3 className="font-bold text-[#0F172A]">{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <XIcon className="w-4.5 h-4.5" />
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- ConfirmDialog ---------------- */

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
            danger ? 'bg-[#D32F2F] hover:bg-red-700' : 'bg-[#E53935] hover:bg-[#D32F2F]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Toast system ---------------- */

interface ToastItem {
  id: number;
  message: string;
}

const ToastCtx = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string) => {
    const id = ++toastCounter;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 pointer-events-none" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
              className="px-5 py-3 bg-[#0F172A] text-white text-sm font-semibold rounded-xl shadow-2xl whitespace-nowrap"
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}