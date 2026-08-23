'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { performanceData } from '@/data/accountData';

type SeriesKey = 'views' | 'enquiries' | 'favorites';

const SERIES_META: Record<SeriesKey, { label: string; color: string }> = {
  views: { label: 'Views', color: '#2563EB' },
  enquiries: { label: 'Enquiries', color: '#E53935' },
  favorites: { label: 'Favorites', color: '#059669' },
};

export const PerformanceChart: React.FC = () => {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    views: true,
    enquiries: true,
    favorites: true,
  });

  const activeSeries = (Object.keys(visible) as SeriesKey[]).filter((k) => visible[k]);

  const toggle = (k: SeriesKey) => setVisible((v) => ({ ...v, [k]: !v[k] }));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-base font-bold">Performance — Last 7 Days</h2>
        <div className="flex items-center gap-2" role="group" aria-label="Toggle series">
          {(Object.keys(SERIES_META) as SeriesKey[]).map((k) => (
            <button
              key={k}
              onClick={() => toggle(k)}
              aria-pressed={visible[k]}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                visible[k]
                  ? 'border-slate-200 bg-slate-50 text-[#0F172A]'
                  : 'border-slate-100 text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: SERIES_META[k].color }} />
              {SERIES_META[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-56 flex items-end justify-between gap-2 sm:gap-4 px-1" role="img" aria-label="Weekly performance bar chart">
        {/* gridlines */}
        {[25, 50, 75, 100].map((p) => (
          <div key={p} className="absolute left-0 right-0 border-t border-dashed border-slate-100 pointer-events-none" style={{ bottom: `${p}%` }} />
        ))}

        {performanceData.labels.map((label, i) => {
          const groupMax = Math.max(
            ...activeSeries.map((k) => performanceData.series[k][i] ?? 0),
            1
          );
          const chartMax = Math.max(...performanceData.labels.map((_, j) =>
            Math.max(...activeSeries.map((k) => performanceData.series[k][j] ?? 0))
          ), 1);
          const heightPct = (v: number) => Math.max((v / chartMax) * 88, activeSeries.length ? 3 : 0);

          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end z-10">
              <div className="flex items-end justify-center gap-1 w-full h-full">
                {activeSeries.map((k) => (
                  <motion.div
                    key={k}
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct(performanceData.series[k][i])}%` }}
                    transition={{ delay: i * 0.06, type: 'spring', stiffness: 120, damping: 18 }}
                    title={`${SERIES_META[k].label}: ${performanceData.series[k][i]}`}
                    className="w-full max-w-[14px] rounded-t-md hover:opacity-80 transition-opacity"
                    style={{ background: SERIES_META[k].color, maxHeight: `${(groupMax / chartMax) * 88}%` }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold text-slate-400">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};