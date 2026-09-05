import { Category, Location, Listing, Business, FilterOptions } from '@/types';
import { detailedCategories } from './taxonomy';

export const categories: Category[] = detailedCategories;

export const locations: Location[] = [
  {
    id: 'l1',
    name: 'Noida',
    slug: 'noida',
    image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&q=80&w=600',
    listingCount: 0,
  },
  {
    id: 'l2',
    name: 'Greater Noida',
    slug: 'greater-noida',
    image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=600',
    listingCount: 0,
  },
  {
    id: 'l3',
    name: 'Delhi',
    slug: 'delhi',
    image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&q=80&w=600',
    listingCount: 0,
  },
  {
    id: 'l4',
    name: 'Gurgaon',
    slug: 'gurgaon',
    image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&q=80&w=600',
    listingCount: 0,
  },
  {
    id: 'l5',
    name: 'Ghaziabad',
    slug: 'ghaziabad',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=600',
    listingCount: 0,
  },
];

export const mockListings: Listing[] = [];

export const promotedBusinesses: Business[] = [];

export const filterOptions: FilterOptions = {
  categories,
  locations,
  priceRanges: [
    { label: 'Under ₹10,000', min: 0, max: 10000 },
    { label: '₹10,000 - ₹50,000', min: 10000, max: 50000 },
    { label: '₹50,000 - ₹1,00,000', min: 50000, max: 100000 },
    { label: '₹1,00,000 - ₹5,00,000', min: 100000, max: 500000 },
    { label: 'Above ₹5,00,000', min: 500000, max: 100000000 },
  ],
  conditions: [
    { value: 'new', label: 'Brand New' },
    { value: 'used_like_new', label: 'Like New' },
    { value: 'used_good', label: 'Good' },
    { value: 'used_fair', label: 'Fair' },
  ],
  dateRanges: [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
  ],
  sortOptions: [
    { value: 'newest', label: 'Newest First' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
    { value: 'popular', label: 'Most Popular' },
  ],
};
