'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { Eye, EyeOff, Check } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const strength = useMemo(() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score; // 0-4
  }, [form.password]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 3) e.fullName = 'Please enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Please enter a valid email address.';
    if (!/^[+\d][\d\s-]{7,14}$/.test(form.phone)) e.phone = 'Please enter a valid phone number.';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    if (!terms) e.terms = 'You must accept the terms & conditions.';
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
        setTimeout(() => (window.location.href = '/auth/verify-email'), 1000);
      }, 1000);
      return;
    }

    const sb = getSupabaseBrowser()!;
    const { data, error: authError } = await sb.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.fullName, phone: form.phone },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    setLoading(false);

    if (authError) {
      const msg = authError.message || '';
      const lower = msg.toLowerCase();
      if (lower.includes('already') || lower.includes('exists') || lower.includes('registered')) {
        setErrors({ form: 'An account with this email already exists. Please check your inbox for the confirmation email or request a new confirmation email.' });
        setCanResend(true);
      } else {
        setErrors({ form: msg });
      }
      return;
    }

    // Session exists immediately when email confirmation is disabled
    setSuccess(true);
    setTimeout(() => {
      window.location.href = data.session ? '/' : '/auth/verify-email';
    }, 900);
  };

  const handleResend = async () => {
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setErrors({ form: 'Please enter a valid email address to resend confirmation.' });
      return;
    }
    setResendLoading(true);
    setResendSuccess(false);
    try {
      const sb = getSupabaseBrowser()!;
      const { error } = await sb.auth.resend({
        type: 'signup',
        email: form.email,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (error) {
        setErrors({ form: error.message });
      } else {
        setResendSuccess(true);
        setErrors({});
      }
    } catch (e: any) {
      setErrors({ form: e?.message || 'Failed to resend confirmation email.' });
    } finally {
      setResendLoading(false);
    }
  };

  const inputCls = (err?: string) =>
    `w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${
      err ? 'border-red-300 bg-red-50' : 'border-slate-200'
    }`;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join millions of buyers and sellers on FindIt — it's free."
    >
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="Registration form">
        <div>
          <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
          <input id="fullName" type="text" autoComplete="name" value={form.fullName} onChange={set('fullName')} aria-invalid={!!errors.fullName} placeholder="Your full name" className={inputCls(errors.fullName)} />
          {errors.fullName && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.fullName}</p>}
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
          <input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} placeholder="you@example.com" className={inputCls(errors.email)} />
          {errors.email && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">Phone</label>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} placeholder="+91 98765 43210" className={inputCls(errors.phone)} />
          {errors.phone && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              aria-invalid={!!errors.password}
              placeholder="Min. 8 characters"
              className={`${inputCls(errors.password)} pr-11`}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Strength meter */}
          {form.password && (
            <div className="flex items-center gap-1.5 mt-2" aria-live="polite">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    strength >= i ? (strength <= 1 ? 'bg-red-400' : strength === 2 ? 'bg-amber-400' : strength === 3 ? 'bg-lime-500' : 'bg-emerald-500') : 'bg-slate-100'
                  }`}
                />
              ))}
              <span className="text-[10px] font-semibold text-slate-400 ml-1">
                {['Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength]}
              </span>
            </div>
          )}
          {errors.password && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
          <input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} aria-invalid={!!errors.confirm} placeholder="Re-enter password" className={inputCls(errors.confirm)} />
          {errors.confirm && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.confirm}</p>}
        </div>

        <div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#E53935]" />
            <span className="text-xs text-slate-600 leading-relaxed">
              I accept the{' '}
              <Link href="/terms" className="text-[#E53935] font-semibold hover:underline">terms &amp; conditions</Link>{' '}
              and privacy policy.
            </span>
          </label>
          {errors.terms && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.terms}</p>}
        </div>

        {errors.form && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-[#D32F2F]">
            {errors.form}
          </div>
        )}
        {canResend && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || resendSuccess}
              className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 text-sm font-semibold rounded-xl transition-colors"
            >
              {resendLoading ? 'Resending…' : resendSuccess ? 'Confirmation email resent' : 'Resend confirmation email'}
            </button>
            {resendSuccess && <p className="text-xs text-emerald-600 font-medium text-center">Check your inbox (and spam) for the new link.</p>}
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
              <Check className="w-4 h-4" /> Account created!
            </>
          ) : loading ? (
            'Creating account...'
          ) : (
            'Create Account'
          )}
        </button>

        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <span title="Google sign-up coming soon" className="w-full flex items-center justify-center gap-3 py-3 border border-slate-100 bg-slate-50 rounded-xl text-sm font-semibold text-slate-400 cursor-not-allowed">
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
            <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
          </svg>
          Sign up with Google
        </span>

        <p className="text-center text-xs text-slate-500 pt-2">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#E53935] hover:underline">Login</Link>
        </p>
      </form>
    </AuthShell>
  );
}