'use client';

import React, { useState } from 'react';
import { FilterOptions as FilterOptionsType } from '@/types';
import { Button } from '../ui/Button';
import { X, RotateCcw } from 'lucide-react';

interface FilterSidebarProps {
  options: FilterOptionsType;
  onApplyFilters: (filters: Record<string, any>) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  options,
  onApplyFilters,
  onClose,
  isMobile = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [datePosted, setDatePosted] = useState<string>('');

  const handleApply = () => {
    onApplyFilters({
      category: selectedCategory,
      location: selectedLocation,
      condition: selectedCondition,
      priceRange,
      datePosted,
    });
    if (onClose) onClose();
  };

  const handleReset = () => {
    setSelectedCategory('');
    setSelectedLocation('');
    setSelectedCondition('');
    setPriceRange(null);
    setDatePosted('');
    onApplyFilters({});
    if (onClose) onClose();
  };

  return (
    <div className={`bg-white p-6 ${isMobile ? '' : 'rounded-2xl border border-slate-100 shadow-sm'}`}>
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
        <h3 className="font-bold text-[#0F172A] text-lg">Filters</h3>
        {isMobile && onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs font-semibold text-[#E53935] hover:underline"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset All
        </button>
      </div>

      <div className="space-y-6">
        {/* Categories Filter */}
        <div>
          <h4 className="font-semibold text-[#0F172A] text-sm mb-3">Categories</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {options.categories.map((cat) => (
              <label key={cat.id} className="flex items-center justify-between text-xs text-slate-600 cursor-pointer hover:text-[#0F172A]">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="category"
                    checked={selectedCategory === cat.slug}
                    onChange={() => setSelectedCategory(cat.slug)}
                    className="text-[#E53935] focus:ring-[#E53935]"
                  />
                  {cat.name}
                </span>
                <span className="text-slate-400 font-medium">({cat.listingCount.toLocaleString()})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Locations Filter */}
        <div>
          <h4 className="font-semibold text-[#0F172A] text-sm mb-3">Location</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {options.locations.map((loc) => (
              <label key={loc.id} className="flex items-center justify-between text-xs text-slate-600 cursor-pointer hover:text-[#0F172A]">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="location"
                    checked={selectedLocation === loc.slug}
                    onChange={() => setSelectedLocation(loc.slug)}
                    className="text-[#E53935] focus:ring-[#E53935]"
                  />
                  {loc.name}
                </span>
                <span className="text-slate-400 font-medium">({loc.listingCount.toLocaleString()})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range Filter */}
        <div>
          <h4 className="font-semibold text-[#0F172A] text-sm mb-3">Price Range</h4>
          <div className="space-y-2">
            {options.priceRanges.map((range, idx) => (
              <label key={idx} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-[#0F172A]">
                <input
                  type="radio"
                  name="priceRange"
                  checked={priceRange?.min === range.min && priceRange?.max === range.max}
                  onChange={() => setPriceRange({ min: range.min, max: range.max })}
                  className="text-[#E53935] focus:ring-[#E53935]"
                />
                {range.label}
              </label>
            ))}
          </div>
        </div>

        {/* Condition Filter */}
        <div>
          <h4 className="font-semibold text-[#0F172A] text-sm mb-3">Condition</h4>
          <div className="space-y-2">
            {options.conditions.map((cond) => (
              <label key={cond.value} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-[#0F172A]">
                <input
                  type="radio"
                  name="condition"
                  checked={selectedCondition === cond.value}
                  onChange={() => setSelectedCondition(cond.value)}
                  className="text-[#E53935] focus:ring-[#E53935]"
                />
                {cond.label}
              </label>
            ))}
          </div>
        </div>

        {/* Date Posted Filter */}
        <div>
          <h4 className="font-semibold text-[#0F172A] text-sm mb-3">Date Posted</h4>
          <div className="space-y-2">
            {options.dateRanges.map((date) => (
              <label key={date.value} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-[#0F172A]">
                <input
                  type="radio"
                  name="datePosted"
                  checked={datePosted === date.value}
                  onChange={() => setDatePosted(date.value)}
                  className="text-[#E53935] focus:ring-[#E53935]"
                />
                {date.label}
              </label>
            ))}
          </div>
        </div>

        <Button variant="primary" size="md" className="w-full" onClick={handleApply}>
          Apply Filters
        </Button>
      </div>
    </div>
  );
};
