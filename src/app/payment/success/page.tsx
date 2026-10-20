'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { CheckCircle2, Rocket, Loader2, MessageSquare } from 'lucide-react';
import { getOrderStatus } from '@/services/payments';
import { useMessagingAccess } from '@/lib/useMessagingAccess';
import { notifyMessagingAccessUpdated } from '@/services/messagingAccess';
import { formatMessagingExpiry } from '@/lib/messagingEntitlement';

/**
 * Success page NEVER decides payment succeeded on its own —
 * it reads the verified status from the backend.
 */
function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const [status, setStatus] = useState<'loading' | 'paid' | 'processing'>(
    orderId ? 'loading' : 'processing'
  );
  const { access, loading: accessLoading } = useMessagingAccess();

  useEffect(() => {
    if (!orderId) return;
    let attempts = 0;
    const check = async () => {
      const o = await getOrderStatus(orderId);
      if (o?.status === 'paid') {
        setStatus('paid');
        notifyMessagingAccessUpdated();
        return;
      }
      if (attempts++ < 5) setTimeout(check, 2500);
      else setStatus('processing');
    };
    void check();
  }, [orderId]);

  const expiry = formatMessagingExpiry(access?.expiresAt);

  return (
    <div className="text-center py-2">
      {status === 'loading' || status === 'processing' ? (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">
            {status === 'loading' ? 'Checking payment…' : 'Your payment is being verified.'}
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            This usually completes within seconds. You can also check your payment history for the latest status.
          </p>
        </>
      ) : (
        <>
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold mb-2">Payment verified!</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Your purchase is active. This status was confirmed by the payment backend.
          </p>

          {!accessLoading && access?.allowed ? (
            <div className="mt-5 mx-auto max-w-xs rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left">
              <p className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <MessageSquare className="w-4 h-4" /> {access.planName || 'Messaging'} is active
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                {expiry ? `Messaging is unlocked until ${expiry}.` : 'Messaging is unlocked.'}
              </p>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-8 space-y-3">
        <Link
          href={orderId ? `/dashboard/payments` : '/dashboard/payments'}
          className="block w-full py-3.5 bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-red-200"
        >
          View Payment History
        </Link>
        <Link href="/dashboard" className="block w-full py-3 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
          Back to Dashboard
        </Link>
      </div>

      <p className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-slate-400">
        <Rocket className="w-3.5 h-3.5" /> Status is verified server-side before display.
      </p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <AuthShell title="Payment Status">
      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-slate-300 mx-auto my-10" />}>
        <SuccessContent />
      </Suspense>
    </AuthShell>
  );
}