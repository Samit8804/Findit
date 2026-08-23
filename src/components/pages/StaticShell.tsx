import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ChevronRight } from 'lucide-react';

export function SupportHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="bg-gradient-to-b from-white to-[#F8FAFC] border-b border-slate-100 pt-12 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{title}</h1>
        <p className="text-sm text-slate-500 mt-3 max-w-xl mx-auto leading-relaxed">{subtitle}</p>
      </div>
    </section>
  );
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <main className="flex-grow py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb-ish */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#E53935]">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="font-semibold text-slate-600">{title}</span>
          </nav>

          <article className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-10">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">{title}</h1>
            <p className="text-xs text-slate-400 mb-8">Last updated: {updated}</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-9 pb-8 border-b border-slate-100">{intro}</p>

            <div className="space-y-9">
              {sections.map((s) => (
                <section key={s.heading}>
                  <h2 className="text-base font-bold mb-3 flex items-start gap-2.5">
                    <span className="w-1 h-5 bg-[#E53935] rounded-full shrink-0 mt-0.5" />
                    {s.heading}
                  </h2>
                  {s.paragraphs?.map((p, i) => (
                    <p key={i} className="text-sm text-slate-600 leading-relaxed mb-3 pl-3.5">
                      {p}
                    </p>
                  ))}
                  {s.bullets && (
                    <ul className="space-y-2 mt-3 pl-3.5">
                      {s.bullets.map((b, i) => (
                        <li key={i} className="text-sm text-slate-600 leading-relaxed flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E53935] shrink-0 mt-2" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100">
              <h2 className="text-base font-bold mb-2">Questions about this policy?</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Reach our compliance team at{' '}
                <a href="mailto:legal@findit.example" className="text-[#E53935] font-semibold hover:underline">legal@findit.example</a>{' '}
                or visit the{' '}
                <Link href="/contact" className="text-[#E53935] font-semibold hover:underline">contact page</Link>.
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}