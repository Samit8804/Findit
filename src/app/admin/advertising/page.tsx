'use client';

import React, { useState } from 'react';
import { Megaphone, MousePointerClick, Eye, Wallet, PlusCircle } from 'lucide-react';
import { campaigns as seed, Campaign } from '@/data/adminData2';
import { DataTable, Tabs as FilterTabs, Input, Select } from '@/components/ui/Form';
import { Modal, useToast } from '@/components/ui/Feedback';

const PLACEMENTS = ['Homepage', 'Category', 'Location', 'Listing', 'Business'];

export default function AdminAdvertisingPage() {
  const toast = useToast();
  const [list, setList] = useState<Campaign[]>(seed);
  const [filter, setFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    advertiser: '',
    bannerText: '',
    destination: '',
    placement: 'Homepage',
    start: '',
    end: '',
    price: '',
    status: 'Scheduled',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const active = list.filter((c) => c.status === 'Active');
  const impressions = active.reduce((s, c) => s + c.impressions, 0);
  const clicks = active.reduce((s, c) => s + c.clicks, 0);
  const revenue = list.reduce((s, c) => s + (c.status !== 'Ended' ? c.price : 0), 0);

  const visible = filter === 'All' ? list : list.filter((c) => c.placement === filter);

  const submitCampaign = () => {
    const errs: Record<string, string> = {};
    if (!form.advertiser.trim()) errs.advertiser = 'Advertiser name required.';
    if (!form.bannerText.trim()) errs.bannerText = 'Banner text required.';
    if (!form.destination.trim()) errs.destination = 'Destination URL required.';
    if (!form.start || !form.end) errs.dates = 'Start and end dates are required.';
    if (!form.price || Number(form.price) <= 0) errs.price = 'Enter a valid price.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setList((prev) => [
      {
        id: `cmp-${Date.now()}`,
        advertiser: form.advertiser,
        bannerText: form.bannerText,
        destination: form.destination,
        placement: form.placement as Campaign['placement'],
        start: form.start,
        end: form.end,
        price: Number(form.price),
        status: form.status as Campaign['status'],
        impressions: 0,
        clicks: 0,
      },
      ...prev,
    ]);
    setFormOpen(false);
    setForm({ advertiser: '', bannerText: '', destination: '', placement: 'Homepage', start: '', end: '', price: '', status: 'Scheduled' });
    toast('Campaign created');
  };

  const stats = [
    { label: 'Active Campaigns', value: String(active.length), icon: Megaphone, cls: 'bg-red-50 text-[#E53935]' },
    { label: 'Impressions', value: impressions.toLocaleString('en-IN'), icon: Eye, cls: 'bg-sky-50 text-sky-600' },
    { label: 'Clicks', value: clicks.toLocaleString('en-IN'), icon: MousePointerClick, cls: 'bg-emerald-50 text-emerald-600' },
    { label: 'CTR', value: impressions ? `${((clicks / impressions) * 100).toFixed(2)}%` : 'â€”', icon: null, cls: 'bg-violet-50 text-violet-600' },
    { label: 'Ad Revenue', value: `â‚¹${revenue.toLocaleString('en-IN')}`, icon: Wallet, cls: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Advertising</h1>
          <p className="text-xs text-black mt-1">Manage banner campaigns across the platform.</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold shadow-md shadow-red-200 transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            {s.icon && (
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.cls}`}>
                <s.icon className="w-4.5 h-4.5" />
              </span>
            )}
            <p className="text-lg font-black">{s.value}</p>
            <p className="text-[10px] font-semibold text-black mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <FilterTabs tabs={['All', ...PLACEMENTS]} active={filter} onChange={setFilter} />

      <DataTable headers={['Advertiser', 'Banner', 'Placement', 'Impressions', 'Clicks', 'CTR', 'Price', 'Status']}>
        {visible.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="pl-5 pr-3 py-3.5 font-bold whitespace-nowrap">{c.advertiser}</td>
            <td className="px-3 py-3.5 text-black max-w-[220px] truncate">{c.bannerText}</td>
            <td className="px-3 py-3.5">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-black">{c.placement}</span>
            </td>
            <td className="px-3 py-3.5 text-black">{c.impressions.toLocaleString('en-IN')}</td>
            <td className="px-3 py-3.5 text-black">{c.clicks.toLocaleString('en-IN')}</td>
            <td className="px-3 py-3.5 text-black">{c.impressions ? `${((c.clicks / c.impressions) * 100).toFixed(1)}%` : 'â€”'}</td>
            <td className="px-3 py-3.5 font-bold whitespace-nowrap">â‚¹{c.price.toLocaleString('en-IN')}</td>
            <td className="pr-5 pl-3 py-3.5">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${
                c.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : c.status === 'Scheduled' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-black'
              }`}>{c.status}</span>
            </td>
          </tr>
        ))}
      </DataTable>

      {/* Create campaign modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Create Advertising Campaign" size="lg">
        <div className="space-y-4">
          <Input label="Advertiser" name="advertiser" value={form.advertiser} onChange={(e) => setForm((f) => ({ ...f, advertiser: e.target.value }))} error={errors.advertiser} placeholder="Business or brand name" />
          <Input label="Banner Text" name="bannerText" value={form.bannerText} onChange={(e) => setForm((f) => ({ ...f, bannerText: e.target.value }))} error={errors.bannerText} placeholder="Headline shown on the banner" />
          <Input label="Destination URL" name="destination" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} error={errors.destination} placeholder="/business/example or https://..." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Placement"
              name="placement"
              value={form.placement}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
              options={PLACEMENTS.map((p) => ({ value: p, label: p }))}
            />
            <Input label="Price (â‚¹)" name="price" type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} error={errors.price} />
            <Input label="Start Date" name="start" type="date" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
            <Input label="End Date" name="end" type="date" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
          </div>
          {errors.dates && <p role="alert" className="text-xs text-red-600 font-medium -mt-2">{errors.dates}</p>}
          <Select
            label="Status"
            name="status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            options={[
              { value: 'Scheduled', label: 'Scheduled' },
              { value: 'Active', label: 'Active' },
            ]}
          />
          <button onClick={submitCampaign} className="w-full py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors shadow-md shadow-red-100">
            Create Campaign
          </button>
        </div>
      </Modal>
    </div>
  );
}