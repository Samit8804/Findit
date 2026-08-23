export type AdStatus = 'Active' | 'Pending' | 'Pending Review' | 'Rejected' | 'Expired' | 'Sold' | 'Archived';

export interface StoredAd {
  id: string;
  userId: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  condition: string;
  images: string[];
  contactEmail: string;
  addressText: string;
  countryIso: string;
  stateIso: string;
  city: string;
  postalCode: string;
  categorySlug: string;
  categoryName: string;
  subcategorySlug: string;
  subcategoryName: string;
  status: AdStatus;
  createdAt: string;
}

const STORAGE_KEY = 'findit:user-ads';

export function getUserAds(userId: string): StoredAd[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const all: StoredAd[] = raw ? JSON.parse(raw) : [];
    return all
      .filter((ad) => ad.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function readAll(): StoredAd[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(ads: StoredAd[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
}

export function addAd(ad: Omit<StoredAd, 'id' | 'createdAt' | 'status'> & { status?: AdStatus }): StoredAd {
  const full: StoredAd = {
    ...ad,
    status: ad.status ?? 'Active',
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.push(full);
  writeAll(all);
  return full;
}

export function deleteAd(id: string) {
  writeAll(readAll().filter((ad) => ad.id !== id));
}

export function updateAd(id: string, patch: Partial<StoredAd>) {
  writeAll(readAll().map((ad) => (ad.id === id ? { ...ad, ...patch } : ad)));
}

export function getAdById(id: string): StoredAd | undefined {
  return readAll().find((ad) => ad.id === id);
}