'use client';

import React from 'react';
import * as Icons from 'lucide-react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { WIZARD_CATEGORIES } from './wizardData';

export const StepCategory: React.FC<{
  value: string;
  onChange: (name: string) => void;
}> = ({ value, onChange }) => {
  return (
    <div>
      <h3 className="text-lg font-bold text-[#0F172A] mb-1">Choose a category</h3>
      <p className="text-xs text-slate-400 mb-5">Pick the category that best fits your ad.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" role="radiogroup" aria-label="Ad category">
        {WIZARD_CATEGORIES.map((cat, idx) => {
          const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }> & { displayName?: string }>)[cat.icon] || Icons.Folder;
          const selected = value === cat.name;
          return (
            <motion.button
              key={cat.name}
              type="button"
              role="radio"
              aria-checked={selected}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => onChange(cat.name)}
              className={`relative p-5 rounded-2xl border-2 transition-all text-left group ${
                selected
                  ? 'border-[#E53935] bg-red-50'
                  : 'border-slate-100 hover:border-red-200 hover:bg-slate-50'
              }`}
            >
              {selected && (
                <span className="absolute top-3 right-3 w-5 h-5 bg-[#E53935] rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
                  selected ? 'bg-[#E53935] text-white' : 'bg-red-50 text-[#E53935]'
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-[#0F172A]">{cat.name}</h4>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};