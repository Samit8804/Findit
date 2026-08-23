import React from 'react';
import { LegalPage } from '@/components/pages/StaticShell';
import { refundContent } from '@/data/legalContent';

export default function Page() {
  return (
    <LegalPage
      title={refundContent.title}
      updated={refundContent.updated}
      intro={refundContent.intro}
      sections={refundContent.sections}
    />
  );
}
