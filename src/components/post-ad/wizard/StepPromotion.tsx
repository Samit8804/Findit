'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Rocket, Sparkles } from 'lucide-react';
import { PromotionPlan } from './wizardData';

interface Plan {
  id: PromotionPlan;
  name: string;
  price: string;
  tagline: string;
  icon: React.ElementType;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'FREE',
    price: '₹0',
    tagline: 'Standard listing',
    icon: Sparkles,
    features: ['30 days visibility', 'Up to 8 photos', 'Standard search ranking', 'Email contact'],
  },
  {
    id: 'featured',
    name: 'FEATURED',
    price: '₹99',
    tagline: '3x more views',
    icon: Rocket,
    highlight: true,
    features: [
      'Everything in FREE',
      'Featured badge on your ad',
      'Top of category results for 7 days',
      'Highlighted in search results',
    ],
  },
  {
    id: 'top',
    name: 'TOP',
    price: '₹199',
    tagline: 'Maximum reach',
    icon: Crown,
    features: [
      'Everything in FEATURED',
      'Homepage spotlight placement',
      'TOP AD badge + gold border',
      'Priority ranking for 30 days',
      'Social media shoutout',
    ],
  },
];

export const StepPromotion: React.FC<{
  value: PromotionPlan;
  onChange: (plan: PromotionPlan) => void;
}> = ({ value, onChange }) => {
  return (
    <div>
      <h3 className="text-lg font-bold text-[#0F172A] mb-1">Boost your ad</h3>
      <p className="text-xs text-slate-400 mb-5">
        Choose how visible you want your advertisement to be. You can also post for free.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" role="radiogroup" aria-label="Promotion plan">
        {PLANS.map((plan, idx) => {
          const Icon = plan.icon;
          const selected = value === plan.id;
          return (
            <motion.button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={selected}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              onClick={() => onChange(plan.id)}
              className={`relative text-left rounded-2xl border-2 p-6 transition-all ${
                selected
                  ? 'border-[#E53935] shadow-lg shadow-red-100'
                  : 'border-slate-100 hover:border-slate-300 hover:shadow-sm'
              } ${plan.highlight ? 'bg-gradient-to-b from-white to-red-50/40' : 'bg-white'}`}
            >
              {/* Most popular flag */}
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#E53935] text-white text-[10px] font-bold uppercase tracking-wider">
                  Most Popular
                </span>
              )}

              {selected && (
                <span className="absolute top-4 right-4 w-6 h-6 bg-[#E53935] rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </span>
              )}

              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
                  plan.highlight ? 'bg-[#E53935] text-white' : 'bg-red-50 text-[#E53935]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <h4 className="font-black tracking-widest text-sm text-[#0F172A]">{plan.name}</h4>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-[#0F172A]">{plan.price}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{plan.tagline}</p>

              <ul className="mt-4 space-y-2 pt-4 border-t border-slate-100">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};