'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { Eye, EyeOff, Check } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Please enter a valid email address.';
    if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);

    /* Demo mode without backend keys */
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setLoading(false);
        setSuccess(true);
        setTimeout(() => (window.location.href = '/'), 1000);
      }, 900);
      return;
    }

    const sb = getSupabaseBrowser()!;
    const { error: authError } = await sb.auth.signInWithPassword({ email, password });

    if (authError) {
      setLoading(false);
      const msg = authError.message.toLowerCase().includes('login')
        ? 'Invalid email or password.'
        : authError.message;
      setErrors({ form: msg });
      return;
    }

    setSuccess(true);
    setTimeout(() => (window.location.href = '/'), 800);
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to manage your ads and connect with buyers.">
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="Login form">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            placeholder="you@example.com"
            className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${
              errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
            }`}
          />
          {errors.email && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.email}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Password</label>
            <Link href="/forgot-password" className="text-xs font-semibold text-[#E53935] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              placeholder="••••••••"
              className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${
                errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.password}</p>}
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 accent-[#E53935]"
          />
          <span className="text-xs text-slate-600">Remember me on this device</span>
        </label>

        {errors.form && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-[#D32F2F]">
            {errors.form}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || success}
          className="w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-red-100"
        >
          {loading && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {success ? (
            <>
              <Check className="w-4 h-4" /> Logged in! Redirecting...
            </>
          ) : loading ? (
            'Logging in...'
          ) : (
            'Login'
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* Google — coming soon */}
        <span
          title="Google sign-in coming soon"
          className="w-full flex items-center justify-center gap-3 py-3 border border-slate-100 bg-slate-50 rounded-xl text-sm font-semibold text-slate-400 cursor-not-allowed"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
            <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
          </svg>
          Continue with Google
        </span>

        <p className="text-center text-xs text-slate-500 pt-2">
          New to FindIt?{' '}
          <Link href="/register" className="font-semibold text-[#E53935] hover:underline">
            Create Account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}