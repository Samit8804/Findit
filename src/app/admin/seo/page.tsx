'use client';

import React, { useState } from 'react';
import {
  FileText,
  Map,
  TrendingUp,
  Search,
  MousePointerClick,
  BarChart3,
  AlertTriangle,
  Link2,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Feedback';

const SEO_STATS = [
  { label: 'Indexed Pages', value: '12,840', icon: FileText, cls: 'bg-sky-50 text-sky-600' },
  { label: 'Sitemap Status', value: 'Healthy', icon: Map, cls: 'bg-emerald-50 text-emerald-600' },
  { label: 'Organic Traffic (30d)', value: '612K', icon: TrendingUp, cls: 'bg-violet-50 text-violet-600' },
  { label: 'Search Impressions', value: '1.4M', icon: Search, cls: 'bg-amber-50 text-amber-600' },
  { label: 'Search Clicks', value: '84.2K', icon: MousePointerClick, cls: 'bg-emerald-50 text-emerald-600' },
  { label: 'Average CTR', value: '6.0%', icon: BarChart3, cls: 'bg-red-50 text-[#E53935]' },
  { label: 'Average Position', value: '#8.4', icon: BarChart3, cls: 'bg-slate-100 text-slate-600' },
  { label: 'SEO Errors', value: '14', icon: AlertTriangle, cls: 'bg-red-50 text-[#D32F2F]' },
];

const TEMPLATES = [
  {
    key: 'homepage',
    title: 'Homepage',
    fields: [
      { key: 'title', label: 'SEO Title', value: 'FindIt — Buy. Sell. Discover. | Classified Marketplace' },
      { key: 'desc', label: 'Meta Description', value: 'Buy and sell everything around you — properties, vehicles, mobiles, jobs and services on FindIt, India\'s trusted classified marketplace.' },
    ],
  },
  {
    key: 'category',
    title: 'Category Page Template',
    fields: [
      { key: 'title', label: 'SEO Title Template', value: '{category} in {location} — Best Deals on FindIt' },
      { key: 'desc', label: 'Meta Description Template', value: 'Browse thousands of verified {category} listings in {location}. Compare prices and contact sellers directly on FindIt.' },
    ],
  },
  {
    key: 'location',
    title: 'Location Page Template',
    fields: [
      { key: 'title', label: 'SEO Title Template', value: '{category} in {city}, {state} — FindIt Local Ads' },
      { key: 'desc', label: 'Meta Description Template', value: 'Find {category} near you in {city}, {state}. Verified local ads updated daily on FindIt.' },
    ],
  },
];

export default function AdminSeoPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState(TEMPLATES);
  const [savedKey, setSavedKey] = useState('');

  const update = (tplKey: string, fieldKey: string, value: string) =>
    setTemplates((prev) =>
      prev.map((t) =>
        t.key === tplKey
          ? { ...t, fields: t.fields.map((f) => (f.key === fieldKey ? { ...f, value } : f)) }
          : t
      )
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">SEO Management</h1>
        <p className="text-xs text-slate-700 mt-1">Search visibility, metadata templates and technical health.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SEO_STATS.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.cls}`}>
              <s.icon className="w-4 h-4" />
            </span>
            <p className="text-lg font-black">{s.value}</p>
            <p className="text-[10px] font-semibold text-slate-700 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Technical status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: '/sitemap.xml', desc: 'Last generated 2 hours ago · 12,840 URLs', ok: true },
          { title: '/robots.txt', desc: 'Allows all crawlers · sitemap referenced', ok: true },
          { title: 'Canonical & Structured Data', desc: 'Product + Breadcrumb JSON-LD detected on ad pages', ok: true },
        ].map((item) => (
          <div key={item.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-xs font-bold">{item.title}</p>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Editable templates */}
      <div className="space-y-5">
        {templates.map((tpl) => (
          <div key={tpl.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#E53935]" /> {tpl.title}
            </h3>
            <div className="space-y-4">
              {tpl.fields.map((f) => (
                <Input
                  key={f.key}
                  label={f.label}
                  name={`${tpl.key}-${f.key}`}
                  value={f.value}
                  onChange={(e) => update(tpl.key, f.key, e.target.value)}
                  hint={
                    f.key === 'title'
                      ? 'Variables: {category}, {location}, {city}, {state}'
                      : 'Aim for 150–160 characters.'
                  }
                />
              ))}
            </div>
            <button
              onClick={() => {
                setSavedKey(tpl.key);
                toast(`${tpl.title} template saved`);
                setTimeout(() => setSavedKey(''), 2000);
              }}
              className={`mt-4 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                savedKey === tpl.key ? 'bg-emerald-500 text-white' : 'bg-[#E53935] hover:bg-[#D32F2F] text-white'
              }`}
            >
              {savedKey === tpl.key ? 'Saved!' : 'Save Template'}
            </button>
          </div>
        ))}
      </div>

      {/* Errors list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-base font-bold mb-4">Top SEO Errors to Fix</h3>
        <ul className="space-y-2.5 text-xs text-slate-600">
          {[
            '6 category pages missing meta descriptions',
            '4 images missing alt attributes on /business/quickfix-plumbing',
            '2 duplicate H1 tags detected on old location landing pages',
            '1 redirect chain: /old-jobs → /jobs → /category/jobs',
          ].map((err) => (
            <li key={err} className="flex items-start gap-2 bg-red-50/60 rounded-lg px-3.5 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#D32F2F] shrink-0 mt-0.5" /> {err}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}