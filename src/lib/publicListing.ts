import { PublicAd } from '@/services/ads';
import { Listing } from '@/types';

export function toListingCardData(ad: PublicAd): Listing {
  const validConditions = ['new', 'used_like_new', 'used_good', 'used_fair'] as const;
  const condition = validConditions.find((value) => value === ad.condition) ?? 'used_good';

  return {
    id: ad.id,
    slug: ad.slug,
    title: ad.title,
    description: ad.description,
    price: ad.price,
    currency: '₹',
    images: ad.images.map((image) => image.url),
    category: ad.categoryName,
    categorySlug: ad.categorySlug,
    country: 'India',
    countrySlug: 'india',
    state: '',
    stateSlug: '',
    city: ad.city ?? '',
    citySlug: (ad.city ?? '').toLowerCase().replace(/\s+/g, '-'),
    location: ad.locationLabel || ad.city || '',
    locationSlug: (ad.city ?? '').toLowerCase().replace(/\s+/g, '-'),
    postedAt: new Date(ad.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    condition,
    featured: ad.isFeatured,
    promoted: !!ad.promotion,
    promotionLabel: ad.promotion?.label,
    verified: ad.seller.verified,
    views: ad.viewsCount,
    favorites: ad.favoritesCount,
    contactEmail: '',
    seller: { name: ad.seller.name, verified: ad.seller.verified, joinedAt: '', email: '' },
  };
}
