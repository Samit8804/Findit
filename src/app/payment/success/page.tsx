import React from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { CheckCircle2, Rocket, LayoutDashboard } from 'lucide-react';

export default function PaymentSuccessPage() {
  return (
    <AuthShell title="Payment Successful!" subtitle="Your promotion is now active.">
      <div className="text-center py-2">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>

        <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-xs mx-auto">
          <strong className="text-[#0F172A]">₹117</strong> paid successfully.
          Your ad is being boosted right now — expect noticeably more views within the hour.
        </p>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-left mb-7">
          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Rocket className="w-3.5 h-3.5" /> What happens next
          </p>
          <ul className="text-xs text-emerald-700 space-y-1 list-disc pl-4">
            <li>Featured badge appears on your ad instantly</li>
            <li>Receipt sent to your registered email</li>
            <li>Track views in your dashboard analytics</li>
          </ul>
        </div>

        <Link
          href="/dashboard/my-ads"
          className="block w-full py-3.5 bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-red-200"
        >
          View My Ads
        </Link>
        <Link
          href="/dashboard"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#E53935]"
        >
          <LayoutDashboard className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    </AuthShell>
  );
}