'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { MailCheck, Check } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1200);
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email linked to your account and we'll send you a reset link."
    >
      {sent ? (
        <div className="text-center py-2" aria-live="polite">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="font-bold text-[#0F172A]">Check your inbox</h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            We sent a password reset link to <strong className="text-[#0F172A]">{email}</strong>.
            The link expires in 30 minutes.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-5 text-xs font-semibold text-[#E53935] hover:underline"
          >
            Didn&apos;t receive it? Resend
          </button>
          <Link
            href="/login"
            className="block w-full py-3 mt-6 bg-slate-100 hover:bg-slate-200 text-sm font-semibold rounded-xl transition-colors"
          >
            Back to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4" aria-label="Forgot password form">
          <div>
            <label htmlFor="fp-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              placeholder="you@example.com"
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${
                error ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            {error && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-red-100"
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? 'Sending reset link...' : 'Send Reset Link'}
          </button>

          <p className="text-center text-xs text-slate-500 pt-1">
            Remembered it?{' '}
            <Link href="/login" className="font-semibold text-[#E53935] hover:underline">Back to Login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}