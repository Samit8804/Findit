import React from 'react';
import { LegalPage } from '@/components/pages/StaticShell';
import { privacyContent } from '@/data/legalContent';

export default function Page() {
  return (
    <LegalPage
      title={privacyContent.title}
      updated={privacyContent.updated}
      intro={privacyContent.intro}
      sections={privacyContent.sections}
    />
  );
}
