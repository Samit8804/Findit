import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildSearchTerms,
  normalizeText,
  rankReferenceAds,
  type AiListingRequest,
  type ListingReference,
} from './listingAssistant';

const CATEGORY_SLUGS: Record<string, string[]> = {
  property: ['property'],
  vehicle: ['vehicles-and-motoring'],
  'vehicles motoring': ['vehicles-and-motoring'],
  'vehicles & motoring': ['vehicles-and-motoring'],
  mobile: ['for-sale', 'phones'],
  electronics: ['for-sale', 'electrical-goods', 'appliances'],
  'home garden': ['for-sale', 'furniture', 'appliances', 'gardening-supplies'],
  'home & garden': ['for-sale', 'furniture', 'appliances', 'gardening-supplies'],
  jobs: ['jobs'],
  services: ['services'],
  business: ['services', 'for-sale', 'property'],
  other: [],
  'for sale': ['for-sale'],
  'for-sale': ['for-sale'],
};

function categorySlugs(category: string): string[] {
  const normalized = normalizeText(category);
  return CATEGORY_SLUGS[normalized] || (normalized.includes('property') ? ['property'] : []);
}

function firstRelation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? first as Record<string, unknown> : null;
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function stringAttribute(attributes: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes || {})) {
    if (Object.keys(result).length >= 12) break;
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) result[key] = text;
    }
  }
  return result;
}

async function resolveCategoryIds(
  supabase: SupabaseClient,
  category: string
): Promise<string[]> {
  const slugs = categorySlugs(category);
  if (slugs.length === 0) return [];
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .in('slug', slugs)
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return (data || []).map((row: { id: string }) => row.id).filter(Boolean);
}

export async function findReferenceListings(
  supabase: SupabaseClient,
  userId: string,
  input: AiListingRequest
): Promise<ListingReference[]> {
  const terms = buildSearchTerms(input);
  if (terms.length === 0) return [];

  const categoryIds = await resolveCategoryIds(supabase, input.category);
  const now = new Date().toISOString();
  const searchFilter = terms
    .flatMap((term) => [`title.ilike.%${term}%`, `description.ilike.%${term}%`])
    .join(',');

  const runQuery = (filterCategory: boolean) => {
    let query = supabase
      .from('ads')
      .select(
        `id, title, description, price, condition, attributes, published_at,
         categories!ads_category_id_fkey(name),
         subcategory:categories!ads_subcategory_id_fkey(name),
         locations(name)`
      )
      .eq('status', 'approved')
      .is('deleted_at', null)
      .neq('user_id', userId)
      .not('published_at', 'is', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .or(searchFilter)
      .order('published_at', { ascending: false })
      .limit(40);

    if (filterCategory && categoryIds.length > 0) {
      query = query.or(
        `category_id.in.(${categoryIds.join(',')}),subcategory_id.in.(${categoryIds.join(',')})`
      );
    }
    return query;
  };

  const firstResult = await runQuery(true);
  if (firstResult.error) throw new Error(firstResult.error.message);
  let data = firstResult.data;
  if ((data || []).length === 0 && categoryIds.length > 0) {
    const fallback = await runQuery(false);
    if (fallback.error) throw new Error(fallback.error.message);
    data = fallback.data;
  }

  const references: ListingReference[] = (data || []).map((row: Record<string, unknown>) => {
    const rootCategory = firstRelation(row.categories);
    const subcategory = firstRelation(row.subcategory);
    const location = firstRelation(row.locations);
    const attributes =
      row.attributes && typeof row.attributes === 'object'
        ? row.attributes as Record<string, unknown>
        : {};
    return {
      title: typeof row.title === 'string' ? row.title : '',
      description: typeof row.description === 'string' ? row.description : '',
      price:
        row.price == null || !Number.isFinite(Number(row.price))
          ? null
          : Number(row.price),
      condition: typeof row.condition === 'string' ? row.condition : null,
      attributes: stringAttribute(attributes),
      category: typeof subcategory?.name === 'string'
        ? subcategory.name
        : typeof rootCategory?.name === 'string'
          ? rootCategory.name
          : null,
      location: typeof location?.name === 'string' ? location.name : null,
      publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    };
  });

  return rankReferenceAds(input, references, 5);
}
