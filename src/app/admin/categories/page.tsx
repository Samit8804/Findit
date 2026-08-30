'use client';

import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { PlusCircle } from 'lucide-react';
import { detailedCategories } from '@/data/taxonomy';
import { Input } from '@/components/ui/Form';
import { Modal, useToast } from '@/components/ui/Feedback';

function CatIcon({ name }: { name: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }> & Record<string, unknown>>)[name] ||
    Icons.Folder;
  return <Icon className="w-4 h-4" />;
}

export default function AdminCategoriesPage() {
  const toast = useToast();
  const [cats, setCats] = useState(
    detailedCategories.map((c) => ({ ...c, active: true }))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const addCategory = () => {
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    if (cats.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('A category with this name already exists.');
      return;
    }
    setCats((prev) => [
      ...prev,
      {
        id: `cat-${Date.now()}`,
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        icon,
        description: '',
        listingCount: 0,
        subcategories: [],
        active: true,
      },
    ]);
    setModalOpen(false);
    setName('');
    setError('');
    toast(`Category "${name.trim()}" created`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Categories</h1>
          <p className="text-xs text-black mt-1">{cats.length} primary categories · click a row to manage subcategories.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold shadow-md shadow-red-200 transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> Add Category
        </button>
      </div>

      <ul className="space-y-3">
        {cats.map((c) => (
          <li key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setCollapsed((s) => ({ ...s, [c.id]: !s[c.id] }))}
              aria-expanded={!collapsed[c.id]}
              className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-slate-50/60 transition-colors"
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.active ? 'bg-red-50 text-[#E53935]' : 'bg-slate-100 text-black'}`}>
                <CatIcon name={c.icon} />
              </span>
              <span className="min-w-0 flex-grow">
                <span className="block font-bold text-sm truncate">{c.name}</span>
                <span className="block text-[11px] text-black mt-0.5">
                  {c.subcategories.length} subcategories · {c.listingCount.toLocaleString()} listings
                </span>
              </span>
              <span
                role="switch"
                aria-checked={c.active}
                aria-label={`${c.active ? 'Deactivate' : 'Activate'} ${c.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCats((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
                  toast(`${c.name} ${!c.active ? 'activated' : 'deactivated'}`);
                }}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${c.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${c.active ? 'translate-x-5' : ''}`} />
              </span>
            </button>

            {!collapsed[c.id] && c.subcategories.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-4 flex flex-wrap gap-2 bg-slate-50/50">
                {c.subcategories.map((sub) => (
                  <span key={sub.id} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-black">
                    {sub.name}
                    <span className="text-black ml-1.5">{sub.listingCount.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Category" size="sm">
        <div className="space-y-4">
          <Input label="Category Name" name="new-cat" value={name} onChange={(e) => setName(e.target.value)} error={error} placeholder="e.g., Fashion & Beauty" />
          <div>
            <label htmlFor="cat-icon" className="block text-sm font-semibold text-black mb-1.5">Icon</label>
            <select
              id="cat-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
            >
              {['Folder', 'Home', 'Car', 'Smartphone', 'Tv', 'Armchair', 'Briefcase', 'Wrench', 'ShoppingBag', 'Heart', 'Ticket', 'Cpu', 'Users'].map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <button onClick={addCategory} className="w-full py-3 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] text-white text-sm font-bold transition-colors">
            Create Category
          </button>
        </div>
      </Modal>
    </div>
  );
}