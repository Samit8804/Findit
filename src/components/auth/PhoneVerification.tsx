   'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Phone, ArrowLeft, Loader2, MessageSquare, Send, CheckCircle, Clock, AlertCircle, Copy } from 'lucide-react';
import {
  normalizeIndianPhoneNumber,
  validateIndianPhoneNumber,
  createPhoneVerificationSession,
  getVerificationSessionStatus,
  openVerificationDeepLink,
  getPhoneVerificationStatus,
  VerificationMethod,
} from '@/services/phoneVerification';

interface PhoneVerificationProps {
  onVerified: () => void;
  onClose?: () => void;
}

export function PhoneVerification({ onVerified, onClose }: PhoneVerificationProps) {
  const [step, setStep] = useState<'phone' | 'method' | 'waiting'>('phone');
  const [phone, setPhone] = useState('');
  const [normalized, setNormalized] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [polling, setPolling] = useState(false);
  const [telegramWebUrl, setTelegramWebUrl] = useState<string | null>(null);
  const [telegramStartCommand, setTelegramStartCommand] = useState<string | null>(null);
  const [commandCopied, setCommandCopied] = useState(false);

  // Check initial verification status
  useEffect(() => {
    let cancelled = false;
    getPhoneVerificationStatus()
      .then((status) => {
        if (!cancelled && status.phoneVerified) {
          onVerified();
        } else if (!cancelled && status.phone) {
          setPhone(status.phone.replace('+91', ''));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingStatus(false);
      });
    return () => { cancelled = true; };
  }, [onVerified]);

  // Countdown timer for session expiration
  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const update = () => {
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        setStep('method');
        setError('Verification session expired. Please try again.');
        setSessionId(null);
        setExpiresAt(null);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Polling for verification status
  useEffect(() => {
    if (!polling || !sessionId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const status = await getVerificationSessionStatus(sessionId);
        if (cancelled) return;
        
        if (status.status === 'verified') {
          onVerified();
        } else if (status.status === 'expired' || status.status === 'failed') {
          setPolling(false);
          setStep('method');
          setError(status.status === 'expired' ? 'Verification session expired. Please try again.' : 'Verification failed. Please try again.');
          setSessionId(null);
          setExpiresAt(null);
        }
      } catch {
        // Ignore polling errors, will retry
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [polling, sessionId, onVerified]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { valid, normalized: norm, error: valErr } = validateIndianPhoneNumber(phone);
    if (!valid || !norm) {
      setError(valErr || 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setNormalized(norm);
    setStep('method');
  };

  const handleMethodSelect = async (method: VerificationMethod) => {
    if (!normalized) return;
    setError('');
    setLoading(true);
    setSelectedMethod(method);
    try {
      const session = await createPhoneVerificationSession(normalized, method);
      setSessionId(session.sessionId);
      setExpiresAt(session.expiresAt);
      setPolling(true);
      setStep('waiting');
      if (method === 'telegram') {
        setTelegramWebUrl(session.deepLink);
        setTelegramStartCommand(`/start VERIFY_${session.token}`);
        setCommandCopied(false);
      } else {
        setTimeout(() => openVerificationDeepLink(session.deepLink), 500);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to start verification.';
      if (msg.toLowerCase().includes('already verified') || msg.toLowerCase().includes('already associated')) {
        setError('This phone number is already verified with another account.');
      } else {
        setError(msg);
      }
      setStep('method');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setError('');
    setSelectedMethod(null);
    setNormalized(null);
    setSessionId(null);
    setExpiresAt(null);
    setPolling(false);
    setTelegramWebUrl(null);
    setTelegramStartCommand(null);
    setCommandCopied(false);
  };

  const handleBackToMethod = () => {
    setStep('method');
    setError('');
    setSessionId(null);
    setExpiresAt(null);
    setPolling(false);
    setTelegramWebUrl(null);
    setTelegramStartCommand(null);
    setCommandCopied(false);
  };

  const copyTelegramStartCommand = async () => {
    if (!telegramStartCommand) return;
    try {
      await navigator.clipboard.writeText(telegramStartCommand);
      setCommandCopied(true);
    } catch {
      setError('Could not copy the command. Select and copy it manually.');
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

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-[#D32F2F] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {step === 'phone' && (
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading || phone.replace(/\D/g, '').length !== 10}
            className="w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Validating...' : 'Continue'}
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Your number will only be used for account verification. We never share it publicly.
          </p>
        </form>
      )}

      {step === 'method' && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-900">{maskedPhone}</span>
            </div>
            <button
              type="button"
              onClick={handleBackToPhone}
              className="text-xs font-semibold text-[#E53935] hover:underline flex items-center gap-1"
              disabled={loading}
            >
              <ArrowLeft className="w-3 h-3" /> Change
            </button>
          </div>

          <p className="text-sm text-slate-600 text-center">Choose a verification method:</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleMethodSelect('whatsapp')}
              disabled={loading}
              className="flex flex-col items-center gap-2 p-4 border-2 border-slate-200 rounded-xl hover:border-[#25D366] hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              <MessageSquare className="w-7 h-7 text-[#25D366]" />
              <span className="font-semibold text-slate-900">WhatsApp</span>
              <span className="text-xs text-slate-500">Opens WhatsApp chat</span>
            </button>

            <button
              type="button"
              onClick={() => handleMethodSelect('telegram')}
              disabled={loading}
              className="flex flex-col items-center gap-2 p-4 border-2 border-slate-200 rounded-xl hover:border-[#0088cc] hover:bg-sky-50 transition-colors disabled:opacity-50"
            >
              <Send className="w-7 h-7 text-[#0088cc]" />
              <span className="font-semibold text-slate-900">Telegram</span>
              <span className="text-xs text-slate-500">Opens Telegram bot</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            You will be redirected to the app to complete verification.
          </p>
        </div>
      )}

      {step === 'waiting' && (
        <div className="space-y-4 text-center">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-900">{maskedPhone}</span>
              <span className="text-xs text-emerald-600 font-medium">
                {selectedMethod === 'whatsapp' ? (
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> WhatsApp</span>
                ) : (
                  <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Telegram</span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={handleBackToMethod}
              className="text-xs font-semibold text-[#E53935] hover:underline flex items-center gap-1"
              disabled={loading}
            >
              <ArrowLeft className="w-3 h-3" /> Change
            </button>
          </div>

          <div className="py-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#E53935] mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Waiting for verification...</h3>
            <p className="text-sm text-slate-600 mb-4">
              {selectedMethod === 'whatsapp'
                ? 'Open WhatsApp and send the verification code.'
                : 'Open Telegram Web, send the command below, then share your phone number with the bot.'}
            </p>

            {selectedMethod === 'telegram' && telegramWebUrl && telegramStartCommand && (
              <div className="space-y-3 mb-4">
                <a
                  href={telegramWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full gap-2 rounded-lg bg-[#0088cc] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0077b5]"
                >
                  <Send className="w-4 h-4" /> Open Telegram
                </a>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left">
                  <code className="min-w-0 flex-1 break-all text-xs text-slate-700">{telegramStartCommand}</code>
                  <button
                    type="button"
                    onClick={copyTelegramStartCommand}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    aria-label="Copy Telegram start command"
                    title="Copy Telegram start command"
                  >
                    {commandCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {commandCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              <span>Session expires in {formatTime(timeRemaining)}</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[11px] text-slate-500">
            <p className="font-medium text-slate-700 mb-1">How it works:</p>
            <ul className="space-y-1 text-left">
              <li className="flex items-center gap-2">
                {selectedMethod === 'whatsapp' ? '1. Open WhatsApp using the link' : '1. Open Telegram Web and open the bot chat'}
              </li>
              <li className="flex items-center gap-2">
                {selectedMethod === 'whatsapp' 
                  ? '2. Send the verification code in the chat'
                  : '2. Send the copied /start command, then share your own phone number'}
              </li>
              <li className="flex items-center gap-2">3. Verification completes automatically</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleBackToMethod}
            disabled={loading}
            className="w-full py-2 text-sm font-semibold text-[#E53935] hover:underline disabled:opacity-50"
          >
            Cancel & Choose Another Method
          </button>
        </div>
      )}
    </div>
  );
}