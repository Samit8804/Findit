'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Condition } from './wizardData';
import { WIZARD_CATEGORIES } from './wizardData';
import { AiFieldButton } from './AiAssistant';
import { ListingAiAssistant } from './ListingAiAssistant';
import type { AiTarget } from '@/lib/ai/listingAssistant';

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new', label: 'Brand New' },
  { value: 'used_like_new', label: 'Used — Like New' },
  { value: 'used_good', label: 'Used — Good' },
  { value: 'used_fair', label: 'Used — Fair' },
];

interface StepDetailsProps {
  category: string;
  title: string;
  description: string;
  price: string;
  condition: Condition;
  extra: Record<string, string>;
  location: string;
  onChange: (patch: Partial<{
    title: string;
    description: string;
    price: string;
    condition: Condition;
  }>) => void;
  onExtraChange: (key: string, value: string) => void;
}

export const StepDetails: React.FC<StepDetailsProps> = ({
  category,
  title,
  description,
  price,
  condition,
  extra,
  location,
  onChange,
  onExtraChange,
}) => {
  const [aiLanguage, setAiLanguage] = useState<'en' | 'hi'>('en');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantTarget, setAssistantTarget] = useState<AiTarget>('both');
  const wizardCategory = WIZARD_CATEGORIES.find((c) => c.name === category);
  const extraFields = wizardCategory?.fields || [];
  const bothEmpty = !title.trim() && !description.trim();
  const bothFilled = Boolean(title.trim() && description.trim());
  const mainTarget: AiTarget = bothEmpty || bothFilled
    ? 'both'
    : !title.trim()
      ? 'title'
      : 'description';
  const mainLabel = bothEmpty
    ? 'Generate with AI'
    : bothFilled
      ? 'Improve with AI'
      : mainTarget === 'title'
        ? 'Generate title with AI'
        : 'Generate description with AI';

  const openAssistant = (target: AiTarget) => {
    setAssistantTarget(target);
    setAssistantOpen(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-[#0F172A] mb-1">Ad details</h3>
        <p className="text-xs text-slate-400 mb-5">
          Fields marked <span className="text-[#E53935]">*</span> are required.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label htmlFor="ai-language" className="text-xs font-medium text-slate-600 uppercase tracking-tighter">AI Language</label>
            <select
              id="ai-language"
              value={aiLanguage}
              onChange={(e) => setAiLanguage(e.target.value as 'en' | 'hi')}
              className="text-xs px-2 py-1.5 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-[#E53935] outline-none"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => openAssistant(mainTarget)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#E53935]"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {mainLabel}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="relative group">
        <label htmlFor="ad-title" className="block text-sm font-semibold text-slate-700 mb-1.5">
          Ad Title <span className="text-[#E53935]">*</span>
        </label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="ad-title"
            type="text"
            value={title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g., Spacious 2 BHK Apartment Near Metro Station"
            maxLength={80}
            aria-describedby="title-count"
            className="w-full min-w-0 flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
          />
          <AiFieldButton
            fieldType="title"
            title={title}
            description={description}
            onOpen={openAssistant}
          />
        </div>
        <p id="title-count" className="text-xs text-slate-400 mt-1">{title.length}/80 characters</p>
      </div>

      {/* Price + condition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ad-price" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Price
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
            <input
              id="ad-price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => onChange({ price: e.target.value })}
              placeholder="0"
              className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <label htmlFor="ad-condition" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Condition
          </label>
          <select
            id="ad-condition"
            value={condition}
            onChange={(e) => onChange({ condition: e.target.value as Condition })}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent bg-white"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic category-specific fields */}
      {extraFields.length > 0 && (
        <fieldset className="pt-4 border-t border-slate-100">
          <legend className="text-sm font-bold text-[#0F172A] pt-4 mb-4">
            Additional details for {category}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {extraFields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`extra-${f.key}`} className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {f.label}
                </label>
                {f.type === 'select' ? (
                  <select
                    id={`extra-${f.key}`}
                    value={extra[f.key] || ''}
                    onChange={(e) => onExtraChange(f.key, e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent bg-white"
                  >
                    <option value="">Select...</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`extra-${f.key}`}
                    type={f.type}
                    value={extra[f.key] || ''}
                    onChange={(e) => onExtraChange(f.key, e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                  />
                )}
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {/* Description */}
      <div className="relative group pt-4 border-t border-slate-100">
        <label htmlFor="ad-desc" className="block text-sm font-semibold text-slate-700 mb-1.5">
          Description <span className="text-[#E53935]">*</span>
        </label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
          <textarea
            id="ad-desc"
            rows={6}
            value={description}
            onChange={(e) => onChange({ description: e.target.value })}
            maxLength={2000}
            aria-describedby="desc-count"
            placeholder="Describe your item or service in detail..."
            className="w-full min-w-0 flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent resize-y"
          />
          <AiFieldButton
            fieldType="description"
            title={title}
            description={description}
            onOpen={openAssistant}
          />
        </div>
        <p id="desc-count" className="text-xs text-slate-400 mt-1">{description.length}/2000 characters</p>
      </div>

      <ListingAiAssistant
        open={assistantOpen}
        target={assistantTarget}
        category={category}
        title={title}
        description={description}
        price={price}
        condition={condition}
        extra={extra}
        location={location}
        language={aiLanguage}
        onLanguageChange={setAiLanguage}
        onClose={() => setAssistantOpen(false)}
        onApply={(patch) => onChange(patch)}
      />
    </div>
  );
};