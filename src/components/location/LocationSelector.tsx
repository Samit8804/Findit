'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check, Globe, MapPin, Building2 } from 'lucide-react';
import {
  getAllCountries,
  getStatesOfCountry,
  getCitiesOfState,
} from '@/lib/locationData';

export interface LocationValue {
  countryIso: string;
  stateIso: string;
  city: string;
}

interface LocationSelectorProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
}

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

function DropdownShell({
  icon: Icon,
  label,
  display,
  disabled,
  open,
  setOpen,
  children,
}: {
  icon: React.ElementType;
  label: string;
  display: React.ReactNode;
  disabled?: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-[#E53935]" /> {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 border rounded-xl text-sm font-medium text-left transition-colors ${
          disabled
            ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-white'
            : 'border-slate-200 text-[#0F172A] hover:border-slate-300'
        }`}
      >
        <span className="truncate">{display}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
        selected ? 'bg-red-50 text-[#E53935] font-semibold' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
      {selected && <Check className="w-4 h-4 shrink-0" />}
    </button>
  );
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({ value, onChange }) => {
  const [openPanel, setOpenPanel] = useState<'country' | 'state' | 'city' | null>(null);
  const [countryQuery, setCountryQuery] = useState('');
  const [stateQuery, setStateQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');

  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  useOutsideClose(countryRef, () => openPanel === 'country' && setOpenPanel(null));
  useOutsideClose(stateRef, () => openPanel === 'state' && setOpenPanel(null));
  useOutsideClose(cityRef, () => openPanel === 'city' && setOpenPanel(null));

  const countries = useMemo(() => getAllCountries(), []);
  const states = useMemo(() => getStatesOfCountry(value.countryIso), [value.countryIso]);
  const cities = useMemo(
    () => getCitiesOfState(value.countryIso, value.stateIso),
    [value.countryIso, value.stateIso]
  );

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countryQuery.toLowerCase())
  );
  const filteredStates = states.filter((s) =>
    s.name.toLowerCase().includes(stateQuery.toLowerCase())
  );
  const filteredCities = cities.filter((c) =>
    c.name.toLowerCase().includes(cityQuery.toLowerCase())
  );

  const selectedCountry = countries.find((c) => c.isoCode === value.countryIso);
  const selectedState = states.find((s) => s.isoCode === value.stateIso);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Step 1: Country */}
      <div ref={countryRef}>
        <DropdownShell
          icon={Globe}
          label="Country"
          open={openPanel === 'country'}
          setOpen={(v) => setOpenPanel(v ? 'country' : null)}
          display={
            selectedCountry ? (
              <span className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedCountry.flag} alt="" className="w-5 h-3.5 rounded-sm object-cover" />
                {selectedCountry.name}
              </span>
            ) : (
              <span className="text-slate-400">Select country...</span>
            )
          }
        >
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder="Search 250 countries..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filteredCountries.length === 0 && (
              <p className="px-4 py-3 text-xs text-slate-400">No countries match your search.</p>
            )}
            {filteredCountries.map((c) => (
              <OptionRow
                key={c.isoCode}
                selected={c.isoCode === value.countryIso}
                onClick={() => {
                  onChange({ countryIso: c.isoCode, stateIso: '', city: '' });
                  setCountryQuery('');
                  setOpenPanel('state');
                }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.flag} alt="" className="w-5 h-3.5 rounded-sm object-cover shrink-0" />
                  <span className="truncate">{c.name}</span>
                </span>
              </OptionRow>
            ))}
          </div>
        </DropdownShell>
      </div>

      {/* Step 2: State / Province */}
      <div ref={stateRef}>
        <DropdownShell
          icon={Building2}
          label="State / Province"
          disabled={!value.countryIso}
          open={openPanel === 'state'}
          setOpen={(v) => setOpenPanel(v ? 'state' : null)}
          display={
            selectedState ? (
              selectedState.name
            ) : (
              <span className={value.countryIso ? 'text-slate-400' : 'text-slate-300'}>
                {value.countryIso ? 'Select state...' : 'Choose a country first'}
              </span>
            )
          }
        >
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={stateQuery}
                onChange={(e) => setStateQuery(e.target.value)}
                placeholder="Search states / regions..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filteredStates.length === 0 && (
              <p className="px-4 py-3 text-xs text-slate-400">No states match your search.</p>
            )}
            {filteredStates.map((s) => (
              <OptionRow
                key={s.isoCode}
                selected={s.isoCode === value.stateIso}
                onClick={() => {
                  onChange({ ...value, stateIso: s.isoCode, city: '' });
                  setStateQuery('');
                  setOpenPanel('city');
                }}
              >
                <span className="truncate">{s.name}</span>
              </OptionRow>
            ))}
          </div>
        </DropdownShell>
      </div>

      {/* Step 3: City / Region */}
      <div ref={cityRef}>
        <DropdownShell
          icon={MapPin}
          label="City / Region"
          disabled={!value.stateIso}
          open={openPanel === 'city'}
          setOpen={(v) => setOpenPanel(v ? 'city' : null)}
          display={
            value.city ? (
              value.city
            ) : (
              <span className={value.stateIso ? 'text-slate-400' : 'text-slate-300'}>
                {value.stateIso ? 'Select city...' : 'Choose a state first'}
              </span>
            )
          }
        >
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="Search cities..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filteredCities.length === 0 && (
              <p className="px-4 py-3 text-xs text-slate-400">No cities match your search.</p>
            )}
            {filteredCities.map((c) => (
              <OptionRow
                key={`${c.name}-${c.stateCode}`}
                selected={c.name === value.city}
                onClick={() => {
                  onChange({ ...value, city: c.name });
                  setCityQuery('');
                  setOpenPanel(null);
                }}
              >
                <span className="truncate">{c.name}</span>
              </OptionRow>
            ))}
          </div>
        </DropdownShell>
      </div>
    </div>
  );
};