'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Consent = 'allowed' | 'declined' | null;

const ConsentCtx = createContext<{ consent: Consent; setConsent: (v: Consent) => void }>({
  consent: null,
  setConsent: () => {},
});

export function useConsent() {
  return useContext(ConsentCtx);
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<Consent>(null);

  useEffect(() => {
    const v = localStorage.getItem('analytics_consent') as Consent;
    setConsentState(v || 'allowed');
  }, []);

  const setConsent = (v: Consent) => {
    if (v) localStorage.setItem('analytics_consent', v);
    else localStorage.removeItem('analytics_consent');
    localStorage.setItem('analytics_consent_updated_at', new Date().toISOString());
    setConsentState(v);
  };

  return <ConsentCtx.Provider value={{ consent, setConsent }}>{children}</ConsentCtx.Provider>;
}

export function ConsentBanner() {
  const { consent, setConsent } = useConsent();
  if (consent !== null) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[100] bg-white rounded-2xl border border-slate-200 shadow-xl p-5">
      <p className="text-sm font-bold">We use analytics</p>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
        We use privacy-friendly analytics to improve FindIt. No personal data is sold.
      </p>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setConsent('allowed')}
          className="flex-1 py-2.5 rounded-xl bg-[#E53935] text-white text-xs font-bold hover:bg-[#D32F2F]"
        >
          Allow Analytics
        </button>
        <button
          onClick={() => setConsent('declined')}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
