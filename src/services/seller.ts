import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

export interface PublicSellerProfile {
  id: string;
  username: string;
  display_name: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  location_text: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  business_verified: boolean;
  account_type: string;
  created_at: string;
  account_type_label: string;
}

export interface SellerAd {
  id: string;
  slug: string;
  title: string;
  price: number;
  images: { url: string; is_primary: boolean }[];
  status: string;
  category_name: string;
  category_slug: string;
  location_name: string;
  created_at: string;
  views_count: number;
  favorites_count: number;
}

export interface SellerWithAds {
  profile: PublicSellerProfile;
  ads: SellerAd[];
}

function reportLookupError(scope: string, code: string | undefined): Error {
  console.error(`Seller ${scope} lookup failed`, { code: code || 'unknown' });
  return new Error(`Unable to load seller ${scope}.`);
}

/**
 * Fetch a public seller profile by username
 */
export async function getPublicSellerByUsername(username: string): Promise<PublicSellerProfile | null> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  
  const sb = getSupabaseBrowser()!;
  
  const { data, error } = await sb
    .from('public_profiles')
    .select('id, username, display_name, name, avatar_url, bio, location_text, phone_verified, email_verified, business_verified, account_type, created_at')
    .eq('username', username.toLowerCase())
    .maybeSingle();
    
  if (error) throw reportLookupError('public profile', error.code);
  if (!data) return null;
  
  const profile = data;
  
  // Check if profile is public (has username set)
  if (!profile.username) return null;
  
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name || profile.name || 'Seller',
    name: profile.name || 'Seller',
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    location_text: profile.location_text,
    phone_verified: profile.phone_verified || false,
    email_verified: profile.email_verified || false,
    business_verified: profile.business_verified || false,
    account_type: profile.account_type || 'individual',
    created_at: profile.created_at,
    account_type_label: profile.account_type === 'business' ? 'Business' : 'Individual',
  };
}

/**
 * Fetch active ads for a seller by user ID
 */
export async function getSellerAds(userId: string): Promise<SellerAd[]> {
  if (!isSupabaseConfigured) return [];
  
  const sb = getSupabaseBrowser()!;
  
  const { data, error } = await sb
    .from('ads')
    .select(`
      id, slug, title, price, status, created_at, views_count, favorites_count,
      categories!ads_category_id_fkey(name, slug),
      locations(name),
      ad_images(image_url, is_primary, sort_order)
    `)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });
    
  if (error) throw reportLookupError('active advertisements', error.code);
  if (!data) return [];
  
  return (data as any[]).map((ad: any) => ({
    id: ad.id,
    slug: ad.slug,
    title: ad.title,
    price: Number(ad.price || 0),
    images: (ad.ad_images || []).map((img: any) => ({
      url: img.image_url,
      is_primary: img.is_primary,
    })),
    status: ad.status,
    category_name: ad.categories?.name || '—',
    category_slug: ad.categories?.slug || '',
    location_name: ad.locations?.name || '—',
    created_at: ad.created_at,
    views_count: ad.views_count || 0,
    favorites_count: ad.favorites_count || 0,
  }));
}

/**
 * Check if a business profile exists for this user
 */
export async function getSellerBusiness(userId: string): Promise<{
  id: string;
  business_name: string;
  business_slug: string;
  business_category: string;
  verification_status: string;
  business_logo: string | null;
} | null> {
  if (!isSupabaseConfigured) return null;
  
  const sb = getSupabaseBrowser()!;
  
  const { data, error } = await sb
    .from('public_business_profiles')
    .select('id, business_name, business_slug, business_category, verification_status, business_logo')
    .eq('user_id', userId)
    .maybeSingle();
    
  if (error) throw reportLookupError('business profile', error.code);
  if (!data) return null;
  
  return data as any;
}