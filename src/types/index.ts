export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  listingCount: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  listingCount: number;
  subcategories: Subcategory[];
}

export interface City {
  id: string;
  name: string;
  slug: string;
  postalCodes: string[];
}

export interface Region {
  id: string;
  name: string;
  slug: string;
  cities: City[];
}

export interface Country {
  id: string;
  name: string;
  slug: string;
  code: string;
  regions: Region[];
}

export interface Location {
  id: string;
  name: string;
  slug: string;
  image: string;
  listingCount: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  categorySlug: string;
  subcategory?: string;
  country: string;
  countrySlug: string;
  countryCode?: string;
  state: string;
  stateSlug: string;
  stateCode?: string;
  city: string;
  citySlug: string;
  postalCode?: string;
  location: string;
  locationSlug: string;
  postedAt: string;
  condition: 'new' | 'used_like_new' | 'used_good' | 'used_fair';
  featured: boolean;
  promoted: boolean;
  verified: boolean;
  views: number;
  favorites: number;
  contactEmail: string;
  seller: {
    name: string;
    avatar?: string;
    verified: boolean;
    joinedAt: string;
    email: string;
  };
}

export interface Business {
  id: string;
  name: string;
  description: string;
  image: string;
  location: string;
  locationSlug: string;
  category: string;
  promoted: boolean;
  verified: boolean;
  rating: number;
  reviewCount: number;
}

export interface FilterOptions {
  categories: Category[];
  locations: Location[];
  priceRanges: { label: string; min: number; max: number }[];
  conditions: { value: string; label: string }[];
  dateRanges: { value: string; label: string }[];
  sortOptions: { value: string; label: string }[];
}

export interface PostAdFormData {
  title: string;
  categorySlug: string;
  subcategorySlug: string;
  countrySlug: string;
  stateSlug: string;
  citySlug: string;
  postalCode: string;
  addressText: string;
  price: number;
  currency: string;
  condition: 'new' | 'used_like_new' | 'used_good' | 'used_fair';
  description: string;
  images: string[];
  contactEmail: string;
  termsAccepted: boolean;
}
