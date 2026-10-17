'use client';

import React, { useCallback, useState } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

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
  const buttonLabel = isEmpty ? 'Generate with AI' : 'Improve with AI';

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          language,
          category,
          title: fieldType === 'title' ? currentValue : '',
          description: fieldType === 'description' ? currentValue : '',
          price: price ? Number(price) : undefined,
          condition,
          location,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI request failed');
      }

      const data = await response.json();

      // Apply result based on field type
      if (fieldType === 'title' && data.titles?.[0]) {
        onResult(data.titles[0]);
      } else if (fieldType === 'description' && data.description) {
        onResult(data.description);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [fieldType, currentValue, category, price, condition, location, language, onResult]);

  return (
    <div className="relative group">
      {error && (
        <div className="absolute -top-8 right-0 z-10">
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 shadow-sm whitespace-nowrap">
            {error}
          </div>
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 h-8 px-2.5 text-xs font-medium transition-colors ${
          isLoading
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-white border border-slate-200 text-slate-600 hover:bg-[#E53935] hover:text-white focus:ring-2 focus:ring-[#E53935] focus:outline-none'
        }`}
        aria-label={buttonLabel}
      >
        {isLoading ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : (
          <Sparkles className="w-3 h-3" />
        )}
      </button>
    </div>
  );
};