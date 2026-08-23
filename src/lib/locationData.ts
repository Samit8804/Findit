import { Country, State, City } from 'country-state-city';

export interface CountryOption {
  isoCode: string;
  name: string;
  flag: string;
}

export interface StateOption {
  isoCode: string;
  name: string;
}

export interface CityOption {
  name: string;
  stateCode: string;
  countryCode: string;
}

export function getAllCountries(): CountryOption[] {
  return Country.getAllCountries()
    .map((c) => ({
      isoCode: c.isoCode,
      name: c.name,
      flag: `https://flagcdn.com/w40/${c.isoCode.toLowerCase()}.png`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getStatesOfCountry(countryIso: string): StateOption[] {
  if (!countryIso) return [];
  return State.getStatesOfCountry(countryIso)
    .map((s) => ({ isoCode: s.isoCode, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCitiesOfState(countryIso: string, stateIso: string): CityOption[] {
  if (!countryIso || !stateIso) return [];
  const seen = new Set<string>();
  return City.getCitiesOfState(countryIso, stateIso)
    .filter((c) => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => ({ name: c.name, stateCode: c.stateCode, countryCode: c.countryCode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCountryByIso(iso: string): CountryOption | undefined {
  const c = Country.getCountryByCode(iso);
  if (!c) return undefined;
  return { isoCode: c.isoCode, name: c.name, flag: `https://flagcdn.com/w40/${c.isoCode.toLowerCase()}.png` };
}

export function getStateByIso(countryIso: string, stateIso: string): StateOption | undefined {
  const s = State.getStateByCodeAndCountry(stateIso, countryIso);
  if (!s) return undefined;
  return { isoCode: s.isoCode, name: s.name };
}