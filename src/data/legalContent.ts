export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export const termsContent = {
  title: 'Terms & Conditions',
  updated: '20 August 2026',
  intro:
    'These Terms govern your use of FindIt, a classified advertisement marketplace operated by FindIt Marketplace Inc. By creating an account, posting an ad or browsing listings, you agree to these Terms in full.',
  sections: [
    {
      heading: '1. Eligibility & Accounts',
      paragraphs: ['You must be at least 18 years old to post ads. You are responsible for keeping your login credentials secure and for all activity that occurs under your account.'],
      bullets: ['One person or business per account', 'Accurate registration information is required', 'Accounts may be suspended for Terms violations'],
    },
    {
      heading: '2. Posting Ads',
      paragraphs: ['Listings must be placed in the correct category with honest descriptions and genuine photos. Duplicate, misleading or prohibited ads may be removed without notice and repeat offenders banned.'],
      bullets: ['No illegal goods, weapons, drugs or counterfeit items', 'No adult content, hate speech or harassment', 'Business bulk-posting requires a Business plan'],
    },
    {
      heading: '3. Transactions Between Users',
      paragraphs: ['FindIt is a venue only. We are not party to any transaction between buyer and seller and do not own, inspect, warrant or deliver any item listed on the platform.'],
    },
    {
      heading: '4. Promotions & Payments',
      paragraphs: ['Optional paid promotions (Boost, Featured, TOP, Business plans) enhance visibility only and do not guarantee sales. Fees are non-refundable except as described in our Refund Policy.'],
    },
    {
      heading: '5. Content Licence',
      paragraphs: ['You retain ownership of content you submit but grant FindIt a worldwide licence to host, display and promote it within the platform while your ad is active.'],
    },
    {
      heading: '6. Limitation of Liability',
      paragraphs: ['To the maximum extent permitted by law, FindIt\'s aggregate liability arising from your use of the platform shall not exceed the amount you paid us in the preceding twelve months.'],
    },
    {
      heading: '7. Changes to These Terms',
      paragraphs: ['We may update these Terms; material changes will be announced by email or platform notice at least 14 days before taking effect.'],
    },
  ],
};

export const privacyContent = {
  title: 'Privacy Policy',
  updated: '20 August 2026',
  intro:
    'Your privacy matters. This policy explains what personal data FindIt collects, why we collect it, how long we keep it, and the choices you have.',
  sections: [
    {
      heading: '1. Data We Collect',
      bullets: [
        'Account data — name, email, phone number and hashed password',
        'Listing data — ad content, photos, location and contact preferences',
        'Usage data — pages visited, searches and device/browser information',
        'Payment metadata — order IDs and transaction status (card details handled by our payment processor)',
      ],
    },
    {
      heading: '2. How We Use Data',
      bullets: [
        'Operating the marketplace — accounts, messaging and search',
        'Safety and fraud prevention, including moderation of reported ads',
        'Service communications such as verification emails and receipts',
        'Product analytics to improve features (aggregated and anonymised)',
      ],
    },
    {
      heading: '3. What We Never Do',
      paragraphs: ['We never sell your personal information to third parties. We do not share your phone number publicly unless you enable "Show phone number" in settings.'],
    },
    {
      heading: '4. Retention',
      paragraphs: ['Deleted accounts are anonymised after a 30-day recovery window. Payment records are retained for 8 years to satisfy tax regulations.'],
    },
    {
      heading: '5. Your Rights',
      bullets: [
        'Access, correct or export your personal data at any time',
        'Request deletion via Settings → Privacy or by contacting support',
        'Object to marketing emails with one click',
        'Lodge a complaint with your local data protection authority',
      ],
    },
    {
      heading: '6. Contact',
      paragraphs: ['Data protection officer: privacy@findit.example'],
    },
  ],
};

export const refundContent = {
  title: 'Refund Policy',
  updated: '20 August 2026',
  intro:
    'Promotion purchases on FindIt (Boost, Featured, TOP, Business subscriptions) are digital services that begin immediately after payment. This policy defines when refunds apply.',
  sections: [
    {
      heading: 'Eligible for Refund',
      bullets: [
        'Duplicate charge for the same promotion',
        'Technical failure where the promoted ad was never displayed',
        'Ad removed by moderation before the promotion started through no fault of yours',
      ],
    },
    {
      heading: 'Not Eligible',
      bullets: [
        'Low views or no sale outcomes — promotions increase visibility, not guaranteed results',
        'Ads deleted by you mid-campaign',
        'Violations leading to removal after the promotion ran',
        'Requests made more than 7 days after the charge date',
      ],
    },
    {
      heading: 'How to Request',
      paragraphs: ['Email billing@findit.example with your order ID (format FND-ORD-XXXX) from the registered email address. Approved refunds return to the original payment method within 5–7 business days.'],
    },
    {
      heading: 'Subscription Cancellation',
      paragraphs: ['Business plans can be cancelled anytime from Settings; access continues until the end of the paid period. Partial months are not pro-rated.'],
    },
  ],
};

export const advertisingContent = {
  title: 'Advertising Policy',
  updated: '20 August 2026',
  intro:
    'This policy applies to banner campaigns purchased through the FindIt Advertising network, distinct from user listing promotions.',
  sections: [
    {
      heading: 'Accepted Advertisers',
      paragraphs: ['Registered businesses with verified contact details. We reserve the right to request documentation proving business legitimacy.'],
    },
    {
      heading: 'Prohibited Content',
      bullets: [
        'Adult services, gambling, tobacco and recreational drugs',
        'Financial products without regulatory disclosure (crypto schemes, ponzi offers)',
        'Political attack advertising and misleading health claims',
        'Any product prohibited under our listing rules',
      ],
    },
    {
      heading: 'Creative Requirements',
      bullets: [
        'Banners must match declared dimensions and stay under 150KB',
        'Claims must be substantiable ("#1", "guaranteed" require proof)',
        'Destination URLs must land on content consistent with the banner',
      ],
    },
    {
      heading: 'Placement & Performance',
      paragraphs: ['Placements (Homepage, Category, Location, Listing, Business) are subject to availability. Impressions and clicks are tracked internally and reported in the advertiser dashboard; third-party tracking pixels require approval.'],
    },
    {
      heading: 'Scheduling & Cancellation',
      paragraphs: ['Campaigns start on the scheduled date. Cancellations before the start date receive a full refund; cancellations mid-flight are refunded pro-rata for unstarted weeks.'],
    },
  ],
};

export const guidelinesContent = {
  title: 'Community Guidelines',
  updated: '20 August 2026',
  intro:
    'FindIt works because people trust each other. These guidelines keep the marketplace safe, fair and useful — violations can lead to ad removal or account suspension.',
  sections: [
    {
      heading: 'Be Honest',
      bullets: [
        'Use real photos of the actual item — no stock or borrowed images',
        'Disclose defects, damage and repair history clearly',
        'Price realistically; bait-and-switch listings are removed',
      ],
    },
    {
      heading: 'Be Respectful',
      bullets: [
        'No harassment, hate speech or discriminatory language in ads or messages',
        'Keep negotiations professional — report abuse instead of retaliating',
      ],
    },
    {
      heading: 'Be Safe',
      bullets: [
        'Never share financial credentials, OTPs or identity documents in chat',
        'Meet in public places for exchanges',
        'Report suspicious behaviour immediately — every report is reviewed',
      ],
    },
    {
      heading: 'Respect the Platform',
      bullets: [
        'No duplicate listings across categories or cities',
        'No scraping, bots or automated bulk-posting',
        'Business sellers should use a Business plan rather than masquerading as individuals',
      ],
    },
    {
      heading: 'Enforcement Ladder',
      bullets: [
        'First violation — warning and ad removal',
        'Repeated violations — temporary suspension',
        'Severe breaches (scams, illegal items) — permanent ban without notice',
      ],
    },
  ],
};