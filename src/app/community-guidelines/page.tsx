import React from 'react';
import { LegalPage } from '@/components/pages/StaticShell';
import { guidelinesContent } from '@/data/legalContent';

export default function Page() {
  return (
    <LegalPage
      title={guidelinesContent.title}
      updated={guidelinesContent.updated}
      intro={guidelinesContent.intro}
      sections={guidelinesContent.sections}
    />
  );
}
