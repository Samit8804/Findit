'use client';

import React, { useState } from 'react';
import { Search, MapPin, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/Button';
import { categories, locations } from '@/data/mockData';

interface SearchBarProps {
  onSearch?: (query: { keyword: string; location: string; category: string }) => void;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, className = '' }) => {
  const [keyword, setKeyword] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({ keyword, location: selectedLocation, category: selectedCategory });
      return;
    }
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (selectedLocation !== 'All Locations') params.set('location', selectedLocation);
    if (selectedCategory !== 'All Categories') params.set('category', selectedCategory);
    window.location.href = `/browse${params.toString() ? `?${params.toString()}` : ''}`;
  };

  return (
    <form
      onSubmit={handleSearchSubmit}
      className={`bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex flex-col md:flex-row items-center gap-2 ${className}`}
    >
      {/* Location Selector */}
      <div className="relative w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setShowLocationDropdown(!showLocationDropdown);
            setShowCategoryDropdown(false);
          }}
          className="w-full flex items-center justify-between text-left text-sm font-medium text-[#0F172A]"
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className="w-4 h-4 text-[#E53935] shrink-0" />
            <span className="truncate">{selectedLocation}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {showLocationDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedLocation('All Locations');
                setShowLocationDropdown(false);
              }}
              className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-[#E53935]"
            >
              All Locations
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  setSelectedLocation(loc.name);
                  setShowLocationDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-[#E53935]"
              >
                {loc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Dropdown */}
      <div className="relative w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setShowCategoryDropdown(!showCategoryDropdown);
            setShowLocationDropdown(false);
          }}
          className="w-full flex items-center justify-between text-left text-sm font-medium text-[#0F172A]"
        >
          <span className="flex items-center gap-2 truncate">
            <SlidersHorizontal className="w-4 h-4 text-[#E53935] shrink-0" />
            <span className="truncate">{selectedCategory}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {showCategoryDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All Categories');
                setShowCategoryDropdown(false);
              }}
              className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-[#E53935]"
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.name);
                  setShowCategoryDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-[#E53935]"
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Keyword Search Input */}
      <div className="flex-1 w-full px-3 py-2 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Find cars, mobiles, properties and more..."
          className="w-full text-sm font-medium text-[#0F172A] placeholder-slate-400 focus:outline-none bg-transparent"
        />
      </div>

      {/* Search Button */}
      <Button type="submit" variant="primary" size="md" className="w-full md:w-auto px-6 py-3">
        Search
      </Button>
    </form>
  );
};
