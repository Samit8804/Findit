'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import type { AiTarget } from '@/lib/ai/listingAssistant';

interface AiFieldButtonProps {
  fieldType: 'title' | 'description';
  title: string;
  description: string;
  onOpen: (target: AiTarget) => void;
}

export const AiFieldButton: React.FC<AiFieldButtonProps> = ({
  fieldType,
  title,
  description,
  onOpen,
}) => {
  const bothEmpty = !title.trim() && !description.trim();
  const fieldEmpty = fieldType === 'title' ? !title.trim() : !description.trim();
  const target: AiTarget = bothEmpty ? 'both' : fieldType;
  const label = bothEmpty
    ? 'Generate with AI'
    : fieldEmpty
      ? `Generate ${fieldType}`
      : `Improve ${fieldType}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(target)}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:border-[#E53935] hover:bg-[#E53935] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
      aria-label={label}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
};
