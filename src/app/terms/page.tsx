import React from 'react';
import { LegalPage } from '@/components/pages/StaticShell';
import { termsContent } from '@/data/legalContent';

export default function Page() {
  return (
    <LegalPage
      title={termsContent.title}
      updated={termsContent.updated}
      intro={termsContent.intro}
      sections={termsContent.sections}
    />
  );
}
