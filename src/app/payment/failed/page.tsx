import React from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { XCircle, RotateCcw, LifeBuoy } from 'lucide-react';

export default function PaymentFailedPage() {
  return (
    <AuthShell title="Payment Failed" subtitle="Unfortunately we couldn't process your payment.">
      <div className="text-center py-2">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-10 h-10 text-[#E53935]" />
        </div>

        <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-xs mx-auto">
          The transaction was declined or cancelled. <strong className="text-[#0F172A]">No money has been deducted</strong> from your account.
        </p>

        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-left mb-7">
          <p className="text-[11px] font-bold text-[#D32F2F] uppercase tracking-wide mb-1.5">Common causes</p>
          <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
            <li>Insufficient balance or daily limit reached</li>
            <li>Incorrect UPI PIN / card details</li>
            <li>Bank server temporarily unavailable</li>
          </ul>
        </div>

        <Link
          href="/dashboard/my-ads"
          className="block w-full py-3.5 bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-red-200"
        >
          Try Again
        </Link>
        <Link
          href="/"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#E53935]"
        >
          <LifeBuoy className="w-3.5 h-3.5" /> Contact Support
          <RotateCcw className="w-3 h-3 ml-2" /> Back to Home
        </Link>
      </div>
    </AuthShell>
  );
}