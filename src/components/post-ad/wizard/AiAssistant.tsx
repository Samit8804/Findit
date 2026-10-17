'use client';

import React, { useCallback, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

interface AiFieldButtonProps {
  fieldType: 'title' | 'description';
  currentValue: string;
  category: string;
  price: string;
  condition: string;
  location: string;
  language: 'en' | 'hi';
  onResult: (text: string) => void;
}

export const AiFieldButton: React.FC<AiFieldButtonProps> = ({
  fieldType,
  currentValue,
  category,
  price,
  condition,
  location,
  language,
  onResult,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = !currentValue.trim();
  const task = isEmpty ? 'generate' : 'improve';
  const buttonLabel = isEmpty ? '✨ Generate with AI' : '✨ Improve with AI';

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const aiInput = {
        task,
        language,
        category,
        price: price ? Number(price) : undefined,
        condition,
        location,
        ...(fieldType === 'title' && currentValue.trim() ? { title: currentValue } : {}),
        ...(fieldType === 'description' && currentValue.trim() ? { description: currentValue } : {}),
      };
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiInput),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI request failed');
      }

      const data: unknown = await response.json();
      if (!data || typeof data !== 'object') {
        throw new Error('AI returned an invalid response. Please try again.');
      }
      const result = data as { titles?: unknown; description?: unknown };

      if (fieldType === 'title') {
        const suggestedTitle = Array.isArray(result.titles) && typeof result.titles[0] === 'string'
          ? result.titles[0].trim()
          : '';
        if (!suggestedTitle) throw new Error('AI did not return a title. Please try again.');
        if (suggestedTitle.length > 80) throw new Error('AI returned a title over 80 characters. Please try again.');
        onResult(suggestedTitle);
      } else {
        const suggestedDescription = typeof result.description === 'string' ? result.description.trim() : '';
        if (!suggestedDescription) throw new Error('AI did not return a description. Please try again.');
        if (suggestedDescription.length > 2000) {
          throw new Error('AI returned a description over 2,000 characters. Please try again.');
        }
        onResult(suggestedDescription);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [fieldType, currentValue, category, price, condition, location, language, onResult]);

  return (
    <div className="flex shrink-0 flex-col items-start gap-1">
      {error && (
        <p className="max-w-56 text-xs text-red-600" role="alert">{error}</p>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium transition-colors ${
          isLoading
            ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'border-slate-200 bg-white text-slate-600 hover:border-[#E53935] hover:bg-[#E53935] hover:text-white focus:ring-2 focus:ring-[#E53935] focus:outline-none'
        }`}
        aria-label={isLoading ? `${task === 'generate' ? 'Generating' : 'Improving'} with AI` : buttonLabel}
      >
        {isLoading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span>{isLoading ? 'Working...' : buttonLabel.replace('✨ ', '')}</span>
      </button>
    </div>
  );
};