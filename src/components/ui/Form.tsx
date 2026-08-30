'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

/* ---------------- Input ---------------- */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className = '', ...props }: InputProps) {
  const inputId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent transition-colors ${
          error ? 'border-red-300 bg-red-50' : 'border-slate-200'
        } ${className}`}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-black mt-1">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 font-medium mt-1">{error}</p>
      )}
    </div>
  );
}

/* ---------------- Select ---------------- */

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ label, options, placeholder, id, className = '', ...props }: SelectProps) {
  const selectId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`w-full appearance-none px-4 py-3 pr-9 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-[#E53935] focus:border-transparent ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black pointer-events-none" />
      </div>
    </div>
  );
}

/* ---------------- Tabs (generic client tabs) ---------------- */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
            active === t
              ? 'bg-[#E53935] text-white border-[#E53935]'
              : 'bg-white text-black border-slate-200 hover:border-slate-300'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Pagination ---------------- */

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <nav className="flex items-center justify-center gap-1.5 py-6" aria-label="Pagination">
      <button
        onClick={() => onChange(Math.max(page - 1, 1))}
        disabled={page === 1}
        aria-label="Previous page"
        className="p-2.5 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:border-slate-300 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-black">…</span>}
          <button
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[40px] h-10 px-3 rounded-xl text-sm font-bold transition-colors ${
              p === page
                ? 'bg-[#E53935] text-white shadow-md shadow-red-100'
                : 'bg-white border border-slate-200 text-black hover:border-slate-300'
            }`}
          >
            {p}
          </button>
        </React.Fragment>
      ))}
      <button
        onClick={() => onChange(Math.min(page + 1, totalPages))}
        disabled={page === totalPages}
        aria-label="Next page"
        className="p-2.5 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:border-slate-300 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}

/* ---------------- DataTable (responsive wrapper) ---------------- */

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] uppercase tracking-wider text-slate-700">
            {headers.map((h, i) => (
              <th key={h} className={`py-3.5 font-bold whitespace-nowrap ${i === 0 ? 'pl-5' : 'px-3'} ${i === headers.length - 1 ? 'pr-5' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}