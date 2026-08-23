import React from 'react';
import { LegalPage } from '@/components/pages/StaticShell';
import { advertisingContent } from '@/data/legalContent';

export default function Page() {
  return (
    <LegalPage
      title={advertisingContent.title}
      updated={advertisingContent.updated}
      intro={advertisingContent.intro}
      sections={advertisingContent.sections}
    />
  );
}
