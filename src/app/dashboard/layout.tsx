import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <main className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-8">
            <div className="lg:w-64 lg:shrink-0">
              <DashboardSidebar userName="Demo User" />
            </div>
            <div className="flex-grow min-w-0 w-full pb-8 lg:pb-0">{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}