'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { CategoryTaxonomy, Subcategory, detailedCategories } from '@/data/taxonomy';

interface CategorySelectorProps {
  selectedCategory: CategoryTaxonomy | null;
  selectedSubcategory: Subcategory | null;
  onCategoryChange: (cat: CategoryTaxonomy) => void;
  onSubcategoryChange: (sub: Subcategory) => void;
  step: 1 | 2 | 3;
  onNext: () => void;
  onBack: () => void;
  children?: React.ReactNode;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  selectedSubcategory,
  onCategoryChange,
  onSubcategoryChange,
  step,
  onNext,
  onBack,
  children,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  /* Step 1 — Primary category */
  if (step === 1) {
    const filteredCategories = detailedCategories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.subcategories.some((sub) => sub.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100">
          <h3 className="text-lg font-bold text-[#0F172A] mb-4">What are you posting?</h3>

          <div className="relative mb-6">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
            {filteredCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat)}
                className={`relative p-5 rounded-2xl border-2 transition-all text-left group ${
                  selectedCategory?.id === cat.id
                    ? 'border-[#E53935] bg-red-50'
                    : 'border-slate-100 hover:border-red-200 hover:bg-slate-50'
                }`}
              >
                {selectedCategory?.id === cat.id && (
                  <Check className="w-5 h-5 text-[#E53935] absolute top-3 right-3" />
                )}
                <div className="w-12 h-12 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <span className="text-xl font-bold">{cat.name.charAt(0)}</span>
                </div>
                <h4 className="font-semibold text-[#0F172A] mb-1">{cat.name}</h4>
                <p className="text-xs text-slate-500">{cat.subcategories.length} subcategories</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onNext}
            disabled={!selectedCategory}
            className="px-6 py-3 bg-[#E53935] text-white rounded-xl font-semibold hover:bg-[#D32F2F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue <ChevronRight className="w-4 h-4 inline ml-2" />
          </button>
        </div>
      </div>
    );
  }

  /* Step 2 — Subcategory */
  if (step === 2) {
    const subcategories = selectedCategory?.subcategories || [];
    const filteredSubs = subcategories.filter((sub) =>
      sub.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100">
          <h3 className="text-lg font-bold text-[#0F172A] mb-4">Select subcategory</h3>

          <div className="relative mb-6">
            <input
              type="text"
              placeholder={`Search in ${selectedCategory?.name}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredSubs.map((sub) => (
              <button
                key={sub.id}
                onClick={() => onSubcategoryChange(sub)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  selectedSubcategory?.id === sub.id
                    ? 'border-[#E53935] bg-red-50'
                    : 'border-slate-100 hover:border-red-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#0F172A]">{sub.name}</span>
                  {selectedSubcategory?.id === sub.id && <Check className="w-5 h-5 text-[#E53935]" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={onNext}
            disabled={!selectedSubcategory}
            className="px-6 py-3 bg-[#E53935] text-white rounded-xl font-semibold hover:bg-[#D32F2F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  /* Step 3 — Location (rendered by parent via children) */
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100">
        <h3 className="text-lg font-bold text-[#0F172A] mb-1">Where is your item located?</h3>
        <p className="text-xs text-slate-400 mb-6">
          Pick a country, then state, then city — each list filters automatically.
        </p>
        {children}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3 bg-[#E53935] text-white rounded-xl font-semibold hover:bg-[#D32F2F] transition-colors flex items-center gap-2"
        >
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};