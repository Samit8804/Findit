'use client';

import { useEffect, useState } from 'react';
import { PhoneVerification } from '@/components/auth/PhoneVerification';
import { getPhoneVerificationStatus } from '@/services/phoneVerification';
import { isSupabaseConfigured } from '@/lib/supabase/client';

interface PhoneGateProps {
  onVerified: () => void;
}

export function PhoneVerificationGate({ onVerified }: PhoneGateProps) {
  const [mounted, setMounted] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setMounted(true);
    
    if (!isSupabaseConfigured) {
      setPhoneVerified(true);
      setChecking(false);
      return;
    }

    getPhoneVerificationStatus()
      .then((status) => {
        setPhoneVerified(status.phoneVerified);
      })
      .catch(() => {
        setPhoneVerified(false);
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  if (!mounted) {
    return (
      <div className="py-8 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-[#E53935] rounded-full animate-spin" />
        <p className="text-sm text-slate-600">Checking verification status...</p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="py-8 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-[#E53935] rounded-full animate-spin" />
        <p className="text-sm text-slate-600">Checking verification status...</p>
      </div>
    );
  }

  if (phoneVerified) {
    return null;
  }

  return (
    <div className="py-8">
      <PhoneVerification onVerified={() => { setPhoneVerified(true); onVerified(); }} />
    </div>
  );
}