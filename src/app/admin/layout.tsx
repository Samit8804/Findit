import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Allow demo mode without backend
  if (!isSupabaseConfigured) {
    return <AdminShell>{children}</AdminShell>;
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return <AdminShell>{children}</AdminShell>;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, account_status, suspended_until')
    .eq('id', user.id)
    .single();

  // Suspended/banned check
  if (profile?.account_status === 'banned') {
    redirect('/login?error=account_banned');
  }
  if (
    profile?.account_status === 'suspended' &&
    profile.suspended_until &&
    new Date(profile.suspended_until) > new Date()
  ) {
    redirect('/login?error=account_suspended');
  }
  // Auto-unsuspend if period elapsed (also handled by cron)
  if (
    profile?.account_status === 'suspended' &&
    profile.suspended_until &&
    new Date(profile.suspended_until) <= new Date()
  ) {
    await supabase
      .from('profiles')
      .update({ account_status: 'active', suspension_reason: null, suspended_until: null })
      .eq('id', user.id);
  }

  const role = (profile?.role as string) || 'user';
  if (!['moderator', 'admin', 'super_admin'].includes(role)) {
    redirect('/');
  }

  return <AdminShell>{children}</AdminShell>;
}