'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Globe, MapPin, Building2, Home } from 'lucide-react';
import {
  Country,
  State,
  City,
} from 'country-state-city';

interface Node {
  key: string;
  label: string;
  level: 0 | 1 | 2 | 3;
  children?: Node[];
}

export default function AdminLocationsPage() {
  const countries = useMemo(
    () => Country.getAllCountries().map((c) => ({ iso: c.isoCode, name: c.name })),
    []
  );

  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [search, setSearch] = useState('');

  const states = useMemo(
    () => (selectedCountry ? State.getStatesOfCountry(selectedCountry) : []),
    [selectedCountry]
  );
  const [selectedState, setSelectedState] = useState('');
  const cities = useMemo(
    () => (selectedState ? City.getCitiesOfState(selectedCountry, selectedState).slice(0, 40) : []),
    [selectedCountry, selectedState]
  );

  const countryName = countries.find((c) => c.iso === selectedCountry)?.name || '';
  const stateName = states.find((s) => s.isoCode === selectedState)?.name || '';

  // Build tree preview for the first state's first city
  const localitySample = ['Sector 1', 'Sector 2', 'Central Area', 'Old Town'];

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Locations</h1>
        <p className="text-xs text-black mt-1">
          Manage the Country → State → City → Locality hierarchy powering search and posting.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Level 1: Countries */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="flex items-center gap-2 text-sm font-bold mb-3"><Globe className="w-4 h-4 text-[#E53935]" /> Countries ({countries.length})</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              aria-label="Search countries"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
            />
          </div>
          <ul className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
            {filteredCountries.map((c) => (
              <li key={c.iso}>
                <button
                  onClick={() => {
                    setSelectedCountry(c.iso);
                    setSelectedState('');
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                    selectedCountry === c.iso ? 'bg-red-50 text-[#E53935] font-bold' : 'hover:bg-slate-50 text-black'
                  }`}
                >
                  {c.name}
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Level 2: States */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="flex items-center gap-2 text-sm font-bold"><MapPin className="w-4 h-4 text-[#E53935]" /> States / Regions {stateName && `· ${countryName}`}</h2>
          </div>
          <ul className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
            {!selectedCountry && (
              <li className="px-4 py-6 text-xs text-black text-center">Select a country first.</li>
            )}
            {states.map((s: { isoCode: string; name: string }) => (
              <li key={s.isoCode}>
                <button
                  onClick={() => setSelectedState(s.isoCode)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                    selectedState === s.isoCode ? 'bg-red-50 text-[#E53935] font-bold' : 'hover:bg-slate-50 text-black'
                  }`}
                >
                  {s.name}
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Level 3+4: Cities & localities */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Building2 className="w-4 h-4 text-[#E53935]" /> Cities & Localities</h2>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-4 space-y-4">
            {!selectedState && (
              <p className="text-xs text-black text-center py-6">Select a state to browse cities.</p>
            )}
            {cities.slice(0, 8).map((c: { name: string }) => (
              <div key={c.name} className="rounded-xl border border-slate-100 overflow-hidden">
                <p className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 text-sm font-bold">
                  <Home className="w-3.5 h-3.5 text-[#E53935]" /> {c.name}
                </p>
                <div className="px-3.5 py-2.5 flex flex-wrap gap-1.5 border-t border-slate-50">
                  {localitySample.map((loc) => (
                    <span key={loc} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-black">
                      {c.name} · {loc}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {cities.length > 8 && (
              <p className="text-[11px] text-black text-center">+ {cities.length - 8} more cities…</p>
            )}
          </div>
        </div>
      </div>

      <Link href="/browse" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E53935] hover:underline">
        Preview location drill-down on the public site
      </Link>
    </div>
  );
}