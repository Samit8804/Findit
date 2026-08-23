'use client';

import React from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Feedback';
import { CalendarClock, PencilLine, RefreshCcw, Rocket, LifeBuoy } from 'lucide-react';

interface StateModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExpiredListingState({ open, onClose }: StateModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="This advertisement has expired." size="sm">
      <div className="text-center py-2">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarClock className="w-8 h-8 text-amber-600" />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          This ad ran its full 30-day visibility period and is no longer shown to buyers.
          Renew it to go live instantly — your photos, description and stats stay intact.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button className="py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5" /> Renew for Free
          </button>
          <button
            onClick={() => (window.location.href = '/promote?id=demo-5')}
            className="py-3 rounded-xl border border-slate-200 hover:border-[#E53935] hover:text-[#E53935] text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <Rocket className="w-3.5 h-3.5" /> Boost It
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function RejectedListingState({
  open,
  onClose,
  reason = 'Photos did not clearly match the item description.',
}: StateModalProps & { reason?: string }) {  return (
    <Modal open={open} onClose={onClose} title="Your advertisement needs changes." size="sm">
      <div className="text-center py-2">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <PencilLine className="w-8 h-8 text-[#E53935]" />
        </div>
        <p className="text-sm font-semibold mb-1">Rejected by moderation</p>
        <p className="text-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-left text-slate-600 leading-relaxed my-4">
          <strong className="block text-[#D32F2F] uppercase tracking-wide text-[10px] mb-1">Reason</strong>
          {reason}
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          Edit the listing to fix the issue and resubmit — most re-reviewed ads are approved within an hour.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button className="py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
            <PencilLine className="w-3.5 h-3.5" /> Edit Ad
          </button>
          <Link
            href="/help"
            className="py-3 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <LifeBuoy className="w-3.5 h-3.5" /> Get Help
          </Link>
        </div>
      </div>
    </Modal>
  );
}