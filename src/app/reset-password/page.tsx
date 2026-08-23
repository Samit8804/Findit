'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { Eye, EyeOff, Check } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) e.password = 'Include at least one uppercase letter.';
    if (!/[0-9]/.test(password)) e.password = 'Include at least one number.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 1600);
    }, 1200);
  };

  const inputCls = (err?: string) =>
    `w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${
      err ? 'border-red-300 bg-red-50' : 'border-slate-200'
    }`;

  return (
    <AuthShell
      title="Create a new password"
      subtitle="Choose a strong password you haven't used before."
    >
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="Reset password form">
        <div>
          <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              placeholder="Min. 8 characters, 1 uppercase, 1 number"
              className={`${inputCls(errors.password)} pr-11`}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
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
          <label htmlFor="reset-confirm" className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!errors.confirm}
            placeholder="Re-enter new password"
            className={inputCls(errors.confirm)}
          />
          {errors.confirm && <p role="alert" className="text-xs text-red-600 font-medium mt-1">{errors.confirm}</p>}
        </div>

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
              <Check className="w-4 h-4" /> Password updated! Redirecting...
            </>
          ) : loading ? (
            'Updating password...'
          ) : (
            'Update Password'
          )}
        </button>
      </form>
    </AuthShell>
  );
}