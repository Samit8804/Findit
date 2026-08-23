'use client';

import React from 'react';
import { MapPin, ShieldCheck, Clock } from 'lucide-react';
import { WizardData } from './wizardData';
import { getCountryByIso, getStateByIso } from '@/lib/locationData';
import { Badge } from '@/components/ui/Badge';

const CONDITION_LABELS: Record<string, string> = {
  new: 'Brand New',
  used_like_new: 'Used - Like New',
  used_good: 'Used - Good',
  used_fair: 'Used - Fair',
};

export const StepPreview: React.FC<{ data: WizardData }> = ({ data }) => {
  const country = getCountryByIso(data.location.countryIso);
  const state = getStateByIso(data.location.countryIso, data.location.stateIso);
  const locationLine = [data.location.city || state?.name, state?.name, country?.name]
    .filter((v, i, arr) => v && arr.indexOf(v) === i)
    .join(', ');

  return (
    <div>
      <h3 className="text-lg font-bold text-[#0F172A] mb-1">Preview your ad</h3>
      <p className="text-xs text-slate-400 mb-5">
        This is exactly how buyers will see your advertisement.
      </p>

      {/* Public listing card replica */}
      <div className="max-w-md bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          {data.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.images[0].src}
              alt={data.title || 'Ad preview'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm font-medium">
              No photo added yet
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {data.promotion === 'featured' && <Badge variant="featured">Featured</Badge>}
            {data.promotion === 'top' && <Badge variant="featured">TOP AD</Badge>}
            <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
              {CONDITION_LABELS[data.condition]}
            </span>
          </div>
          {data.images.length > 1 && (
            <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold">
              1/{data.images.length}
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              ₹{data.price ? Number(data.price).toLocaleString('en-IN') : '—'}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          </div>

          <h4 className="font-semibold text-[#0F172A] line-clamp-2 text-sm leading-snug mb-3 min-h-[2.5rem]">
            {data.title || 'Your ad title will appear here'}
          </h4>

          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
            {data.description || 'Your description preview appears here.'}
          </p>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 truncate max-w-[60%]">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {[data.locality, locationLine].filter(Boolean).join(' — ') || 'Location'}
            </span>
            <span className="font-medium text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Just now
            </span>
          </div>
        </div>
      </div>

      {/* Extra details summary */}
      {Object.keys(data.extra).some((k) => data.extra[k]) && (
        <div className="max-w-md mt-6 grid grid-cols-2 gap-3">
          {Object.entries(data.extra)
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{k.replace(/([A-Z])/g, ' $1')}</p>
                <p className="text-sm font-semibold text-[#0F172A] mt-0.5">{v}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};