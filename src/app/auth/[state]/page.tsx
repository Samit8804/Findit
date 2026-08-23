import React from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { MailCheck, ShieldCheck, XCircle, Clock } from 'lucide-react';

export function generateStaticParams() {
  return [
    { state: 'verify-email' },
    { state: 'verified' },
    { state: 'verification-failed' },
    { state: 'expired' },
  ];
}

interface AuthStatePageProps {
  params: Promise<{ state: string }>;
}

const STATES = {
  'verify-email': {
    icon: MailCheck,
    iconClasses: 'bg-sky-50 text-sky-600',
    title: 'Verify Your Email',
    message:
      "We've sent a verification link to your email address. Click the link in the email to activate your FindIt account. The link is valid for 24 hours.",
    primary: { label: 'Resend Verification Email', href: '/auth/verify-email' },
    secondary: { label: 'Back to Login', href: '/login' },
  },
  verified: {
    icon: ShieldCheck,
    iconClasses: 'bg-emerald-50 text-emerald-600',
    title: 'Account Verified!',
    message:
      'Great news — your email has been verified and your FindIt account is now fully active. Start posting ads or explore listings around you.',
    primary: { label: 'Go to My Dashboard', href: '/dashboard/my-ads' },
    secondary: { label: 'Browse Ads', href: '/browse' },
  },
  'verification-failed': {
    icon: XCircle,
    iconClasses: 'bg-red-50 text-[#E53935]',
    title: 'Verification Failed',
    message:
      "We couldn't verify your email. The link may be incorrect or already used. Request a fresh verification email and try again.",
    primary: { label: 'Resend Verification Email', href: '/auth/verify-email' },
    secondary: { label: 'Contact Support', href: '/login' },
  },
  expired: {
    icon: Clock,
    iconClasses: 'bg-amber-50 text-amber-600',
    title: 'Link Expired',
    message:
      'This verification link has expired for security reasons. Enter your email on the login page to receive a brand new link.',
    primary: { label: 'Get a New Link', href: '/forgot-password' },
    secondary: { label: 'Back to Login', href: '/login' },
  },
} as const;

type StateKey = keyof typeof STATES;

export default async function AuthStatePage({ params }: AuthStatePageProps) {
  const { state } = await params;
  const config = STATES[(state as StateKey) in STATES ? (state as StateKey) : 'verify-email'];
  const Icon = config.icon;

  return (
    <AuthShell title={config.title}>
      <div className="text-center py-2">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${config.iconClasses}`}>
          <Icon className="w-10 h-10" />
        </div>
        <p className="text-sm text-slate-500 leading-relaxed mb-7">{config.message}</p>

        <div className="space-y-3">
          <Link
            href={config.primary.href}
            className="block w-full py-3 bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-red-100"
          >
            {config.primary.label}
          </Link>
          <Link
            href={config.secondary.href}
            className="block w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-sm font-semibold rounded-xl transition-colors"
          >
            {config.secondary.label}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}