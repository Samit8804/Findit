import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthShell: React.FC<AuthShellProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* Slim top bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-[#E53935] flex items-center justify-center text-white font-black text-lg shadow-md group-hover:scale-105 transition-transform">
              F
            </div>
            <span className="text-lg font-black tracking-tight">
              Find<span className="text-[#E53935]">It</span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#E53935] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-8 sm:p-10">
            {/* Logo mark */}
            <div className="flex justify-center mb-6">
              <Link href="/" className="w-14 h-14 rounded-2xl bg-[#E53935] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-red-200 hover:scale-105 transition-transform">
                F
              </Link>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-center">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 text-center mt-2 mb-7 leading-relaxed">{subtitle}</p>}

            {children}
          </div>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-6">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Secured with 256-bit encryption. Your data stays private.
          </p>
        </div>
      </main>
    </div>
  );
};