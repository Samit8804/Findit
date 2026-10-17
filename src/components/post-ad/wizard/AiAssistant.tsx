'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

interface AiAssistantProps {
  category: string;
  title: string;
  description: string;
  price: string;
  condition: string;
  location: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onBrandChange?: (brand: string) => void;
  onModelChange?: (model: string) => void;
  onLocationChange?: (location: string) => void;
}

interface AiResult {
  titles: string[];
  description: string;
  highlights: string[];
  keywords: string[];
  missingDetails?: string[];
}

type AiTask = 'generate' | 'improve';
type AiLanguage = 'en' | 'hi';
type AiStatus = 'idle' | 'loading' | 'success' | 'error';

interface AiAssistantState {
  status: AiStatus;
  result: AiResult | null;
  error: string | null;
  selectedTitleIndex: number | null;
  editedDescription: string;
  language: AiLanguage;
  task: AiTask;
  brand: string;
  model: string;
  notes: string;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  category,
  title: initialTitle,
  description: initialDescription,
  price,
  condition,
  location,
  onTitleChange,
  onDescriptionChange,
}) => {
  const [state, setState] = useState<AiAssistantState>({
    status: 'idle',
    result: null,
    error: null,
    selectedTitleIndex: null,
    editedDescription: initialDescription,
    language: 'en',
    task: 'generate',
    brand: '',
    model: '',
    notes: '',
  });

  const isGenerating = state.status === 'loading';

  const callAi = useCallback(async (task: AiTask, language: AiLanguage) => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          language,
          category,
          title: initialTitle,
          description: initialDescription,
          price: price ? Number(price) : undefined,
          condition,
          location,
          brand: state.brand,
          model: state.model,
          notes: state.notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `AI request failed with status ${response.status}`);
      }

      const data: AiResult = await response.json();

      setState((prev) => ({
        ...prev,
        status: 'success',
        result: data,
        selectedTitleIndex: null,
        editedDescription: data.description,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: message,
      }));
    }
  }, [category, initialTitle, initialDescription, price, condition, location, state.brand, state.model, state.notes]);

  const applyTitle = useCallback(() => {
    if (state.result && state.selectedTitleIndex !== null) {
      const title = state.result.titles[state.selectedTitleIndex];
      onTitleChange(title);
    }
  }, [state.result, state.selectedTitleIndex, onTitleChange]);

  const applyDescription = useCallback(() => {
    if (state.result) {
      onDescriptionChange(state.editedDescription);
    }
  }, [state.result, state.editedDescription, onDescriptionChange]);

  const applyBoth = useCallback(() => {
    if (state.result && state.selectedTitleIndex !== null) {
      onTitleChange(state.result.titles[state.selectedTitleIndex]);
      onDescriptionChange(state.editedDescription);
    }
  }, [state.result, state.selectedTitleIndex, state.editedDescription, onTitleChange, onDescriptionChange]);

  const discard = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'idle',
      result: null,
      error: null,
      selectedTitleIndex: null,
      editedDescription: initialDescription,
    }));
  }, [initialDescription]);

  const regenerate = useCallback(() => {
    if (state.task) {
      callAi(state.task, state.language);
    }
  }, [state.task, state.language, callAi]);

  const handleGenerate = useCallback(() => {
    setState((prev) => ({ ...prev, task: 'generate' }));
    callAi('generate', state.language);
  }, [callAi, state.language]);

  const handleImprove = useCallback(() => {
    setState((prev) => ({ ...prev, task: 'improve' }));
    callAi('improve', state.language);
  }, [callAi, state.language]);

  const handleLanguageChange = useCallback((lang: AiLanguage) => {
    setState((prev) => ({ ...prev, language: lang }));
  }, []);

  const handleBrandChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, brand: e.target.value }));
  }, []);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, model: e.target.value }));
  }, []);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState((prev) => ({ ...prev, notes: e.target.value }));
  }, []);

  const handleEditedDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState((prev) => ({ ...prev, editedDescription: e.target.value }));
  }, []);

  const handleTitleSelect = useCallback((index: number) => {
    setState((prev) => ({ ...prev, selectedTitleIndex: index }));
  }, []);

  const hasResults = state.status === 'success' && state.result !== null;

  return (
    <div className="space-y-5 bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#E53935]" />
          <h3 className="text-sm font-bold text-[#0F172A]">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-slate-600 uppercase tracking-tighter">Language</label>
          <select
            value={state.language}
            onChange={(e) => handleLanguageChange(e.target.value as AiLanguage)}
            className="text-xs px-2 py-1 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-[#E53935] outline-none"
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
          </select>
        </div>
      </div>

      {/* Input fields for context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Brand (optional)</label>
          <input
            type="text"
            value={state.brand}
            onChange={handleBrandChange}
            placeholder="e.g., Samsung"
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-[#E53935] outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Model (optional)</label>
          <input
            type="text"
            value={state.model}
            onChange={handleModelChange}
            placeholder="e.g., Galaxy S24"
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-[#E53935] outline-none"
          />
        </div>
      </div>

      <div className="mt-2">
        <label className="text-xs font-medium text-slate-600 block mb-1">Additional notes (optional)</label>
        <textarea
          value={state.notes}
          onChange={handleNotesChange}
          placeholder="Any additional details about your item..."
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-[#E53935] outline-none resize-y"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isGenerating
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#E53935] text-white hover:bg-[#C0281E]'
          }`}
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Generating...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              <span>Generate with AI</span>
            </div>
          )}
        </button>
        <button
          onClick={handleImprove}
          disabled={isGenerating || (!initialTitle && !initialDescription)}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isGenerating || (!initialTitle && !initialDescription)
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Improving...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Check className="w-3 h-3" />
              <span>Improve with AI</span>
            </div>
          )}
        </button>
      </div>

      {/* Error state */}
      {state.error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700 flex items-start gap-2">
          <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{state.error}</p>
            <p className="text-xs text-red-600 mt-1">
              Please check your input or try again later.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {hasResults && state.result && (
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-[#0F172A]">AI Results</h4>
            <button
              onClick={discard}
              className="text-xs text-slate-500 hover:text-[#E53935] flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Discard
            </button>
          </div>

          {/* Title suggestions */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-600 block mb-2">
              Select a Title
            </label>
            <div className="grid grid-cols-1 gap-2">
              {state.result.titles.map((title, index) => (
                <button
                  key={index}
                  onClick={() => handleTitleSelect(index)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    state.selectedTitleIndex === index
                      ? 'bg-[#E53935] text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{title}</span>
                    {state.selectedTitleIndex === index && (
                      <Check className="w-3 h-3" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-600 block mb-2">
              Description
            </label>
            <textarea
              value={state.editedDescription}
              onChange={handleEditedDescriptionChange}
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-[#E53935] outline-none resize-y"
            />
          </div>

          {/* Highlights */}
          {state.result.highlights.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 block mb-2">
                Key Highlights
              </label>
              <div className="flex flex-wrap gap-2">
                {state.result.highlights.map((highlight) => (
                  <span key={highlight} className="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600 border border-slate-200">
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {state.result.keywords.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 block mb-2">
                Search Keywords
              </label>
              <div className="flex flex-wrap gap-1">
                {state.result.keywords.map((keyword) => (
                  <span key={keyword} className="px-2 py-1 rounded bg-purple-50 text-purple-600 text-xs border border-purple-100">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing details */}
          {state.result.missingDetails && state.result.missingDetails.length > 0 && (
            <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-100">
              <h5 className="text-xs font-bold text-amber-800 mb-1">
                ⚠ Suggested Details to Add
              </h5>
              <ul className="text-xs text-amber-700 list-disc list-inside space-y-1">
                {state.result.missingDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Apply buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={applyTitle}
              disabled={!state.selectedTitleIndex && state.selectedTitleIndex !== 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                state.selectedTitleIndex === null
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#E53935] text-white hover:bg-[#C0281E]'
              }`}
            >
              Apply Title
            </button>
            <button
              onClick={applyDescription}
              disabled={state.editedDescription === initialDescription}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                state.editedDescription === initialDescription
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#E53935] text-white hover:bg-[#C0281E]'
              }`}
            >
              Apply Description
            </button>
            <button
              onClick={applyBoth}
              disabled={state.selectedTitleIndex === null || state.editedDescription === initialDescription}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                state.selectedTitleIndex === null || state.editedDescription === initialDescription
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#0F172A] text-white hover:bg-[#1e293b]'
              }`}
            >
              Apply Both
            </button>
            <button
              onClick={regenerate}
              disabled={isGenerating}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-[#E53935] transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};