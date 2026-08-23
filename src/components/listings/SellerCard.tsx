import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Clock, Zap } from 'lucide-react';

interface SellerCardProps {
  name: string;
  joinedAt: string;
  verified?: boolean;
  responseTime?: string;
  isBusiness?: boolean;
}

export const SellerCard: React.FC<SellerCardProps> = ({
  name,
  joinedAt,
  verified = false,
  responseTime = 'Usually responds within 2 hours',
  isBusiness = false,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-base font-bold mb-4">
        {isBusiness ? 'Business Info' : 'Seller Info'}
      </h2>

      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center font-black text-xl shrink-0">
          {name.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm flex items-center gap-1.5 truncate">
            {name}
            {verified && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
          </p>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> Member since {joinedAt}
          </p>
          {isBusiness && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#E53935] mt-1">
              <Zap className="w-3 h-3" /> Business Account
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        {responseTime}
      </p>

      <Link
        href="#"
        className="block w-full text-center py-2.5 rounded-xl border border-slate-200 hover:border-[#E53935] hover:text-[#E53935] transition-colors text-sm font-semibold"
      >
        View Profile
      </Link>
    </div>
  );
};

const SAFETY_TIPS = [
  'Meet the seller in a safe public place.',
  'Inspect the item carefully before paying.',
  'Never share banking PINs or OTP codes.',
  'Avoid advance payments to unknown sellers.',
];

export const SafetyTipsCard: React.FC = () => (
  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
    <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
      <ShieldCheck className="w-4 h-4" /> Safety Tips
    </h3>
    <ul className="space-y-2">
      {SAFETY_TIPS.map((tip) => (
        <li key={tip} className="text-xs text-emerald-700 leading-relaxed list-disc pl-4">
          {tip}
        </li>
      ))}
    </ul>
  </div>
);