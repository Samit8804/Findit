'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { WIZARD_CATEGORIES, type Condition } from './wizardData';
import { generateAiListing, type AiListingResult } from '@/services/aiListing';
import type { AiLanguage, AiTarget } from '@/lib/ai/listingAssistant';

interface ListingAiAssistantProps {
  open: boolean;
  target: AiTarget;
  category: string;
  title: string;
  description: string;
  price: string;
  condition: Condition;
  extra: Record<string, string>;
  location: string;
  language: AiLanguage;
  onLanguageChange: (language: AiLanguage) => void;
  onClose: () => void;
  onApply: (patch: { title?: string; description?: string }) => void;
}

interface AssistantForm {
  itemName: string;
  brand: string;
  model: string;
  condition: '' | Condition;
  ageOrPurchase: string;
  price: string;
  location: string;
  details: string;
}

const CONDITION_OPTIONS: { value: '' | Condition; label: string }[] = [
  { value: '', label: 'Not specified' },
  { value: 'new', label: 'Brand new' },
  { value: 'used_like_new', label: 'Used - like new' },
  { value: 'used_good', label: 'Used - good' },
  { value: 'used_fair', label: 'Used - fair' },
];

function buildDetails(category: string, extra: Record<string, string>): string {
  const categoryConfig = WIZARD_CATEGORIES.find((item) => item.name === category);
  const skip = new Set(['brand', 'model', 'year', 'ageYears']);
  return (categoryConfig?.fields || [])
    .filter((field) => !skip.has(field.key) && extra[field.key]?.trim())
    .map((field) => `${field.label}: ${extra[field.key].trim()}`)
    .join('\n')
    .slice(0, 1200);
}

function buildAgeOrPurchase(extra: Record<string, string>): string {
  if (extra.year?.trim()) return `Year of manufacture/purchase: ${extra.year.trim()}`;
  if (extra.ageYears?.trim()) return `Age: ${extra.ageYears.trim()} year(s)`;
  return '';
}

export const ListingAiAssistant: React.FC<ListingAiAssistantProps> = ({
  open,
  target,
  category,
  title,
  description,
  price,
  condition,
  extra,
  location,
  language,
  onLanguageChange,
  onClose,
  onApply,
}) => {
  const [form, setForm] = useState<AssistantForm>({
    itemName: '',
    brand: '',
    model: '',
    condition: '',
    ageOrPurchase: '',
    price: '',
    location: '',
    details: '',
  });
  const [preview, setPreview] = useState<AiListingResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const initializedRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const itemNameRef = useRef<HTMLInputElement | null>(null);
  const titleId = 'ai-listing-title';

  useEffect(() => {
    if (!open || initializedRef.current) return;
    initializedRef.current = true;
    setForm({
      itemName: title.trim(),
      brand: extra.brand || '',
      model: extra.model || '',
      condition,
      ageOrPurchase: buildAgeOrPurchase(extra),
      price,
      location,
      details: buildDetails(category, extra),
    });
  }, [open, title, extra, condition, price, location, category]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => itemNameRef.current?.focus(), 50);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const updateForm = (patch: Partial<AssistantForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError('');
  };

  const hasExistingTitle = Boolean(title.trim());
  const hasExistingDescription = Boolean(description.trim());
  const isImproving =
    (target === 'both' && (hasExistingTitle || hasExistingDescription)) ||
    (target === 'title' && hasExistingTitle) ||
    (target === 'description' && hasExistingDescription);

  const modalTitle = target === 'both'
    ? isImproving
      ? 'Improve your listing with AI'
      : 'Generate your listing with AI'
    : target === 'title'
      ? hasExistingTitle
        ? 'Improve your title with AI'
        : 'Generate a title with AI'
      : hasExistingDescription
        ? 'Improve your description with AI'
        : 'Generate a description with AI';

  const submitLabel = target === 'both'
    ? isImproving
      ? 'Improve listing'
      : 'Generate listing'
    : target === 'title'
      ? hasExistingTitle
        ? 'Improve title'
        : 'Generate title'
      : hasExistingDescription
        ? 'Improve description'
        : 'Generate description';

  const handleGenerate = async () => {
    if (requestInFlightRef.current) return;
    const itemName = form.itemName.trim();
    if (itemName.length < 2) {
      setError('Enter the product or service name so the AI has something factual to work from.');
      itemNameRef.current?.focus();
      return;
    }
    if (!category.trim()) {
      setError('Choose a category before generating a listing.');
      return;
    }
    let numericPrice: number | undefined;
    if (form.price.trim()) {
      numericPrice = Number(form.price);
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        setError('Enter a valid price or leave it blank.');
        return;
      }
    }

    requestInFlightRef.current = true;
    setIsLoading(true);
    setError('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 40_000);

    try {
      const result = await generateAiListing(
        {
          target,
          language,
          category: category.trim(),
          itemName,
          currentTitle: title.trim() || undefined,
          currentDescription: description.trim() || undefined,
          brand: form.brand.trim() || undefined,
          model: form.model.trim() || undefined,
          condition: form.condition || undefined,
          ageOrPurchase: form.ageOrPurchase.trim() || undefined,
          price: numericPrice,
          location: form.location.trim() || undefined,
          details: form.details.trim() || undefined,
        },
        { signal: controller.signal }
      );
      setPreview(result);
    } catch (caught) {
      if (controller.signal.aborted) {
        setError('AI took too long to respond. Your details are safe. Please try again.');
      } else {
        setError(caught instanceof Error ? caught.message : 'AI could not generate your listing.');
      }
    } finally {
      window.clearTimeout(timeout);
      requestInFlightRef.current = false;
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const handleApply = () => {
    if (!preview) return;
    const patch: { title?: string; description?: string } = {};
    if (target !== 'description') {
      const nextTitle = preview.title?.trim() || '';
      if (nextTitle.length < 5) {
        setError('The title must be at least 5 characters before you apply it.');
        return;
      }
      patch.title = nextTitle;
    }
    if (target !== 'title') {
      const nextDescription = preview.description?.trim() || '';
      if (nextDescription.length < 20) {
        setError('The description must be at least 20 characters before you apply it.');
        return;
      }
      patch.description = nextDescription;
    }
    onApply(patch);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#E53935]">
              <Sparkles className="h-3 w-3" />
              AI listing assistant
            </span>
            <h2 id={titleId} className="mt-2 text-lg font-black tracking-tight text-[#0F172A] sm:text-xl">
              {modalTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              We use only the details you provide. Nothing is published or saved until you continue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI listing assistant"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Category</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                {category || 'Not selected'}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Search className="h-3 w-3" />
                Similar approved ads are used only as references
              </span>
            </div>

            <div>
              <label htmlFor="ai-item-name" className="block text-sm font-semibold text-slate-700">
                Product or service name <span className="text-[#E53935]">*</span>
              </label>
              <input
                ref={itemNameRef}
                id="ai-item-name"
                type="text"
                value={form.itemName}
                onChange={(event) => updateForm({ itemName: event.target.value })}
                maxLength={160}
                placeholder="e.g., iPhone 13 Pro 128GB"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
              />
              <p className="mt-1 text-xs text-slate-400">
                Be specific. This is the main fact the AI will use.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ai-brand" className="block text-sm font-semibold text-slate-700">
                  Brand <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="ai-brand"
                  type="text"
                  value={form.brand}
                  onChange={(event) => updateForm({ brand: event.target.value })}
                  maxLength={100}
                  placeholder="e.g., Apple"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                />
              </div>
              <div>
                <label htmlFor="ai-model" className="block text-sm font-semibold text-slate-700">
                  Model <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="ai-model"
                  type="text"
                  value={form.model}
                  onChange={(event) => updateForm({ model: event.target.value })}
                  maxLength={100}
                  placeholder="e.g., A2638"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                />
              </div>
              <div>
                <label htmlFor="ai-condition" className="block text-sm font-semibold text-slate-700">
                  Condition <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <select
                  id="ai-condition"
                  value={form.condition}
                  onChange={(event) => updateForm({ condition: event.target.value as '' | Condition })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                >
                  {CONDITION_OPTIONS.map((option) => (
                    <option key={option.value || 'unspecified'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ai-age" className="block text-sm font-semibold text-slate-700">
                  Age or purchase date <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="ai-age"
                  type="text"
                  value={form.ageOrPurchase}
                  onChange={(event) => updateForm({ ageOrPurchase: event.target.value })}
                  maxLength={100}
                  placeholder="e.g., Bought in March 2024"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                />
              </div>
              <div>
                <label htmlFor="ai-price" className="block text-sm font-semibold text-slate-700">
                  Price <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₹
                  </span>
                  <input
                    id="ai-price"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={form.price}
                    onChange={(event) => updateForm({ price: event.target.value })}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="ai-location" className="block text-sm font-semibold text-slate-700">
                  Location <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="ai-location"
                  type="text"
                  value={form.location}
                  onChange={(event) => updateForm({ location: event.target.value })}
                  maxLength={200}
                  placeholder="e.g., Sector 150, Noida"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ai-details" className="block text-sm font-semibold text-slate-700">
                Accessories, features or additional details{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="ai-details"
                rows={3}
                value={form.details}
                onChange={(event) => updateForm({ details: event.target.value })}
                maxLength={1200}
                placeholder="e.g., Box, charger, 2 years old, minor scratch on the back"
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
              />
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-slate-600">Output language</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Output language">
                {([
                  ['en', 'English'],
                  ['hi', 'Hindi'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onLanguageChange(value)}
                    aria-pressed={language === value}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      language === value
                        ? 'bg-[#E53935] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading || !form.itemName.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E53935] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#D32F2F] disabled:cursor-not-allowed disabled:opacity-50"
                aria-busy={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isLoading ? 'Writing...' : submitLabel}
              </button>
            </div>

            {preview && (
              <div className="space-y-4 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Review before applying</h3>
                    <p className="text-xs text-slate-500">
                      {preview.reference_count > 0
                        ? `Compared with ${preview.reference_count} similar approved listing${preview.reference_count === 1 ? '' : 's'}.`
                        : 'No similar approved listings were found, so this uses only your details.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                </div>

                {target !== 'description' && (
                  <div>
                    <label htmlFor="ai-preview-title" className="block text-sm font-semibold text-slate-700">
                      Title
                    </label>
                    <input
                      id="ai-preview-title"
                      type="text"
                      value={preview.title || ''}
                      onChange={(event) => setPreview((current) => current ? { ...current, title: event.target.value } : current)}
                      maxLength={80}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                    />
                    <p className="mt-1 text-xs text-slate-400">{(preview.title || '').length}/80 characters</p>
                  </div>
                )}

                {target !== 'title' && (
                  <div>
                    <label htmlFor="ai-preview-description" className="block text-sm font-semibold text-slate-700">
                      Description
                    </label>
                    <textarea
                      id="ai-preview-description"
                      rows={8}
                      value={preview.description || ''}
                      onChange={(event) => setPreview((current) => current ? { ...current, description: event.target.value } : current)}
                      maxLength={2000}
                      className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#E53935]"
                    />
                    <p className="mt-1 text-xs text-slate-400">{(preview.description || '').length}/2000 characters</p>
                  </div>
                )}

                {(preview.missing_details.length > 0 || preview.questions.length > 0) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                      Optional details you could add
                    </p>
                    {preview.missing_details.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-amber-900">
                        {preview.missing_details.map((detail) => (
                          <li key={detail} className="flex gap-2">
                            <span aria-hidden="true">-</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {preview.questions.length > 0 && (
                      <p className="mt-2 text-xs text-amber-900">
                        {preview.questions.join(' ')}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {target === 'both'
                      ? 'Use this listing'
                      : target === 'title'
                        ? 'Use this title'
                        : 'Use this description'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
