'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ShieldCheck, Lock, CreditCard, Loader2 } from 'lucide-react';
import { getOrderStatus, OrderStatus } from '@/services/payments';
import { openRazorpayCheckout, verifyPaymentApi } from '@/lib/payments/checkout';
import { isSupabaseConfigured, getSupabaseBrowser } from '@/lib/supabase/client';

function CheckoutContent({ initialOrderId }: { initialOrderId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Internal order id: route param or ?order= (demo)
  const orderId = initialOrderId || searchParams.get('order') || '';

  const [order, setOrder] = useState<(OrderStatus & { providerOrderId?: string; keyId?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!isSupabaseConfigured || !orderId) {
      setLoading(false);
      return;
    }
    try {
      const o = await getOrderStatus(orderId);
      if (!o) setLoadError('Order not found.');
      else setOrder(o);
    } catch {
      setLoadError('Unable to load this order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  /* Poll while pending verification */
  useEffect(() => {
    if (!verifying) return;
    const timer = setInterval(async () => {
      if (!orderId) return;
      const o = await getOrderStatus(orderId);
      if (o && (o.status === 'paid' || o.status === 'failed')) {
        clearInterval(timer);
        window.location.href = o.status === 'paid' ? `/payment/success?order=${orderId}` : `/payment/failed?order=${orderId}`;
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [verifying, orderId]);

  const startCheckout = async () => {
    setError('');
    if (!isSupabaseConfigured || !order?.providerOrderId || !order.keyId) {
      // Demo mode — no keys configured
      flashDemo();
      return;
    }
    setPaying(true);
    try {
      await openRazorpayCheckout({
        keyId: order.keyId,
        providerOrderId: order.providerOrderId,
        amountPaise: Math.round(order.amount * 100),
        name: 'FindIt Marketplace',
        description: order.promotionName || 'Advertisement promotion',
        onSuccess: async (res) => {
          setVerifying(true);
          try {
            await verifyPaymentApi({
              orderId,
              razorpayOrderId: res.razorpay_order_id,
              razorpayPaymentId: res.razorpay_payment_id,
              razorpaySignature: res.razorpay_signature,
            });
            window.location.href = `/payment/success?order=${orderId}`;
          } catch {
            // Webhook may still land — show processing page
            window.location.href = `/payment/pending?order=${orderId}`;
          }
        },
        onDismiss: () => {
          setPaying(false);
          router.push(`/payment/failed?order=${orderId}&reason=cancelled`);
        },
      });
    } catch (e: any) {
      setPaying(false);
      setError(e.message === 'CHECKOUT_LOAD_FAILED' ? 'Could not reach the payment gateway.' : e.message);
    }

    function flashDemo() {
      setVerifying(true);
      setTimeout(() => (window.location.href = '/payment/success'), 1200);
    }
  };

  const [error, setError] = useState('');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Checkout' }]} />

          <div className="text-center mb-8 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-mono font-bold text-slate-500">
              ORDER {orderId.slice(0, 12)}
            </span>
            <h1 className="text-3xl font-black tracking-tight mt-3">Secure Checkout</h1>
            <p className="text-sm text-slate-500 mt-1.5">Complete your promotion purchase below.</p>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-slate-200 rounded" />)}
              <div className="h-12 bg-slate-200 rounded-xl mt-6" />
            </div>
          ) : loadError || !order ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-100">
              <p className="text-sm font-semibold text-[#D32F2F]">{loadError || 'This advertisement is no longer available.'}</p>
              <Link href="/dashboard/my-ads" className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold">Back to My Ads</Link>
            </div>
          ) : (
            <>
              {/* Already resolved states */}
              {(order.status === 'paid') && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center" role="status">
                  <p className="text-sm font-semibold text-emerald-800">✓ This order has already been paid.</p>
                  <button onClick={() => (window.location.href = `/payment/success?order=${orderId}`)} className="mt-2 text-xs font-bold text-emerald-700 underline">View receipt</button>
                </div>
              )}
              {(order.status === 'sold' as any) && null}

              {/* Order summary */}
              <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-6 ${order.status === 'paid' ? 'opacity-60' : ''}`}>
                <h2 className="font-bold mb-5 flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#E53935]" /> Order Summary</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Advertisement</dt><dd className="font-semibold text-right max-w-[240px] truncate">{order.adTitle ?? '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Promotion</dt><dd className="font-semibold">{order.promotionName ?? '—'}{order.promotionDays ? ` · ${order.promotionDays} days` : ''}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="font-semibold">₹{order.amount.toLocaleString('en-IN')}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">GST</dt><dd className="font-semibold text-slate-400">Included where applicable</dd></div>
                  <div className="flex justify-between pt-4 border-t border-slate-100 text-lg">
                    <dt className="font-black">Total Payable</dt>
                    <dd className="font-black text-[#E53935]">₹{order.amount.toLocaleString('en-IN')}</dd>
                  </div>
                </dl>

                <p className="text-[11px] text-slate-400 leading-relaxed mt-4 p-3 bg-slate-50 rounded-xl">
                  Taxes/fees are included in the listed price as configured by FindIt. You will receive a receipt
                  after successful payment.
                </p>
              </div>

              {/* Pay */}
              {(order.status === 'created' || order.status === 'pending') ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                  <h2 className="font-bold mb-5">Payment Method</h2>
                  <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-[#E53935] bg-red-50/50 cursor-pointer">
                    <input type="radio" name="pay-method" defaultChecked className="accent-[#E53935]" />
                    <Lock className="w-4 h-4 text-[#E53935]" />
                    <span className="text-sm font-bold">UPI / Card / NetBanking (Razorpay)</span>
                  </label>

                  {error && <p role="alert" className="mt-3 text-xs font-semibold text-[#D32F2F]">{error}</p>}

                  <button
                    onClick={startCheckout}
                    disabled={paying}
                    className="mt-6 w-full py-4 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-base font-bold transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Opening secure checkout…
                      </>
                    ) : (
                      `Pay ₹${order.amount.toLocaleString('en-IN')} Securely`
                    )}
                  </button>

                  {verifying && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs font-semibold text-amber-800 text-center" role="status">
                      Your payment is being verified. Please check your payment history.
                    </div>
                  )}

                  <p className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> Verified by signature server-side. Status never trusted from the browser.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PaymentPage({ initialOrderId }: { initialOrderId?: string }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    }>
      <CheckoutContent initialOrderId={initialOrderId} />
    </Suspense>
  );
}
