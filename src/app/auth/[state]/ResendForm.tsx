'use client';

import React, { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export function ResendForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const sb = getSupabaseBrowser()!;
      const { error } = await sb.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to resend email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 mt-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
        aria-label="Email for resend"
      />
      {error && <p role="alert" className="text-xs text-red-600 font-medium">{error}</p>}
      {success && <p role="status" className="text-xs text-emerald-600 font-medium">Confirmation email resent — check your inbox (and spam).</p>}
      <button
        type="submit"
        disabled={loading || success}
        className="w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Resending…' : success ? 'Email resent' : 'Resend confirmation email'}
      </button>
    </form>
  );
}
