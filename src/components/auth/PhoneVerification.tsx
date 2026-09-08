'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import {
  normalizeIndianPhoneNumber,
  validateIndianPhoneNumber,
  sendPhoneOtp,
  verifyPhoneOtp,
  getPhoneVerificationStatus,
} from '@/services/phoneVerification';

interface PhoneVerificationProps {
  onVerified: () => void;
  onClose?: () => void;
}

export function PhoneVerification({ onVerified, onClose }: PhoneVerificationProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [normalized, setNormalized] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPhoneVerificationStatus()
      .then((status) => {
        if (!cancelled && status.phoneVerified) {
          onVerified();
        } else if (!cancelled && status.phone) {
          // Pre-fill phone if exists but not verified
          setPhone(status.phone.replace('+91', ''));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onVerified]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const { valid, normalized: norm, error: valErr } = validateIndianPhoneNumber(phone);
    if (!valid || !norm) {
      setError(valErr || 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await sendPhoneOtp(norm);
      setNormalized(res.normalized);
      setStep('otp');
      setResendCooldown(60);
      setOtp('');
    } catch (err: any) {
      const msg = err?.message || 'Failed to send OTP.';
      if (msg.toLowerCase().includes('already verified') || msg.toLowerCase().includes('already associated')) {
        setError('This phone number is already associated with another FindIt account.');
      } else if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
        setError('Too many OTP requests. Please wait a minute and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!normalized) {
      setError('Phone number not set. Please go back and enter phone again.');
      return;
    }
    if (!otp || otp.trim().length < 4) {
      setError('Enter a valid 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      await verifyPhoneOtp(normalized, otp.trim());
      onVerified();
    } catch (err: any) {
      const msg = err?.message || 'Invalid OTP.';
      const lower = msg.toLowerCase();
      if (lower.includes('expired') || lower.includes('expired otp')) {
        setError('OTP has expired. Please request a new code.');
      } else if (lower.includes('invalid') || lower.includes('incorrect')) {
        setError('Invalid OTP. Please check the code and try again.');
      } else if (lower.includes('already verified') || lower.includes('already associated')) {
        setError('This phone number is already associated with another FindIt account.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      if (!normalized) throw new Error('Phone not set');
      // Re-send via same service (will handle duplicate check again)
      await sendPhoneOtp(normalized);
      setResendCooldown(60);
      setOtp('');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = normalized ? `${normalized.slice(0, 3)}****${normalized.slice(-2)}` : phone ? `${phone.slice(0, 2)}****${phone.slice(-2)}` : '';

  if (checkingStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <p className="text-sm text-slate-600">Checking verification status...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#E53935]/10 text-[#E53935] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-900">Verify your phone to post an ad</h2>
          <p className="text-xs text-slate-600 mt-0.5">We verify phone numbers to help keep FindIt safe and reduce spam.</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close">
            <span className="text-lg leading-none">&times;</span>
          </button>
        )}
      </div>

      {step === 'phone' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Mobile number
            </label>
            <div className="flex gap-2">
              <span className="inline-flex items-center px-3 py-3 border border-slate-200 rounded-xl bg-slate-50 text-sm font-semibold text-slate-700 select-none">
                +91
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                aria-invalid={!!error}
                disabled={loading}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Enter your 10-digit Indian mobile number.</p>
          </div>

          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-[#D32F2F]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || phone.replace(/\D/g, '').length !== 10}
            className="w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            By continuing, you agree to receive an OTP via SMS for verification.
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-900">{maskedPhone}</span>
              <span className="text-xs text-emerald-600 font-medium">OTP sent</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setError('');
                setOtp('');
              }}
              className="text-xs font-semibold text-[#E53935] hover:underline flex items-center gap-1"
              disabled={loading}
            >
              <ArrowLeft className="w-3 h-3" /> Change
            </button>
          </div>

          <div>
            <label htmlFor="otp" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Enter verification code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm tracking-widest text-center font-mono focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
              aria-invalid={!!error}
              disabled={loading}
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-slate-500">
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Didn’t receive code?'}
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-xs font-semibold text-[#E53935] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Resend OTP
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-[#D32F2F]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || otp.trim().length < 4}
            className="w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>

          <p className="text-[11px] text-slate-500 text-center">Code valid for a few minutes. Check SMS and spam.</p>
        </form>
      )}
    </div>
  );
}
