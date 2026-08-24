import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateSlug } from '@/lib/images';
import { adSubmissionSchema } from '@/lib/validation/ad';
import { mockListings } from '@/data/mockData';
import { demoAds } from '@/data/accountData';

export type DbAdStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'expired' | 'sold' | 'deleted';

export interface PublicAd {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  images: { url: string; isPrimary: boolean; sortOrder: number }[];
  categoryName: string;
  categorySlug: string;
  locationLabel: string;
  city?: string;
  attributes: Record<string, string>;
  createdAt: string;
  viewsCount: number;
  favoritesCount: number;
  isFeatured: boolean;
  seller: {
    id: string;
    name: string;
    verified: boolean;
    showPhone: boolean;
    phone?: string;
    showWhatsApp: boolean;
    whatsapp?: string;
    allowMessages: boolean;
    email?: string;
  };
  status: string;
}

const PAGE_SIZE = 24;

/* ------------------------------------------------------------------ */
/* PUBLIC LISTINGS — approved, not deleted, not expired, paginated     */
/* ------------------------------------------------------------------ */

export interface PublicListParams {
  page?: number;
  categorySlug?: string;
  subcategorySlug?: string;
  citySlug?: string;
  minPrice?: number;
  maxPrice?: number;
}

export async function listPublicAds(params: PublicListParams = {}): Promise<{ ads: PublicAd[]; hasMore: boolean }> {
  const page = params.page ?? 1;
  if (!isSupabaseConfigured) return { ads: mockAsPublic(), hasMore: false };

  const sb = getSupabaseBrowser()!;
  const from = (page - 1) * PAGE_SIZE;

  let query = sb
    .from('ads')
    .select(
      `id, slug, title, description, price, condition, attributes, created_at,
       views_count, favorites_count, is_featured,
       contact_show_phone, contact_show_whatsapp, contact_allow_messages,
       categories!ads_category_id_fkey(name, slug),
       locations(name),
       profiles:user_id(name, is_verified, phone, whatsapp),
       ad_images(image_url, is_primary, sort_order)`,
      { count: 'exact' }
    )
    .eq('status', 'approved')
    .is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (params.categorySlug) query = query.eq('categories.slug', params.categorySlug);
  if (params.subcategorySlug) query = query.eq('categories.slug', params.subcategorySlug);
  if (params.citySlug) query = query.ilike('locations.name', `%${params.citySlug.replace(/-/g, ' ')}`);
  if (params.minPrice != null) query = query.gte('price', params.minPrice);
  if (params.maxPrice != null) query = query.lte('price', params.maxPrice);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    ads: (data || []).map(mapRowToPublicAd),
    hasMore: (count ?? 0) > from + PAGE_SIZE,
  };
}

function mapRowToPublicAd(row: any): PublicAd {
  const images = (row.ad_images || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((i: any) => ({ url: i.image_url, isPrimary: i.is_primary, sortOrder: i.sort_order }));
  const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price: Number(row.price ?? 0),
    condition: row.condition ?? 'used_good',
    images,
    categoryName: cat?.name ?? '',
    categorySlug: cat?.slug ?? '',
    locationLabel: row.locations?.name ?? '',
    city: row.locations?.name,
    attributes: row.attributes ?? {},
    createdAt: row.created_at,
    viewsCount: row.views_count,
    favoritesCount: row.favorites_count,
    isFeatured: row.is_featured,
    status: 'approved',
    seller: {
      id: row.user_id,
      name: row.profiles?.name ?? 'Seller',
      verified: !!row.profiles?.is_verified,
      showPhone: !!row.contact_show_phone,
      phone: row.contact_show_phone ? row.profiles?.phone : undefined,
      showWhatsApp: !!row.contact_show_whatsapp,
      whatsapp: row.contact_show_whatsapp ? row.profiles?.whatsapp : undefined,
      allowMessages: row.contact_allow_messages !== false,
    },
  };
}

/* ------------------------------------------------------------------ */
/* SINGLE AD BY SLUG                                                   */
/* ------------------------------------------------------------------ */

export async function getPublicAdBySlug(slug: string): Promise<PublicAd | null> {
  if (!isSupabaseConfigured) {
    const mock = mockAsPublic().find((m) => m.slug === slug) || null;
    return mock;
  }
  const sb = getSupabaseBrowser()!;
  const { data, error } = await sb
    .from('ads')
    .select(
      `id, slug, title, description, price, condition, attributes, created_at,
       views_count, favorites_count, is_featured, status, user_id, deleted_at, expires_at,
       contact_show_phone, contact_show_whatsapp, contact_allow_messages,
       categories!ads_category_id_fkey(name, slug), locations(name),
       profiles:user_id(name, is_verified, phone, whatsapp),
       ad_images(image_url, is_primary, sort_order)`
    )
    .eq('slug', slug)
    .single();

  if (error || !data) return null;

  // Non-public ads are only visible to their owner
  const isPublic = data.status === 'approved' && !data.deleted_at && (!data.expires_at || new Date(data.expires_at) > new Date());
  if (!isPublic) {
    const { data: me } = await sb.auth.getUser();
    if (!me.user || me.user.id !== data.user_id) return null;
  }

  void incrementAdViews(data.id);
  return mapRowToPublicAd(data);
}

/* ------------------------------------------------------------------ */
/* VIEW COUNTER — secure RPC (+1 only, server-controlled)              */
/* ------------------------------------------------------------------ */

const viewSession = typeof window !== 'undefined' ? sessionStorage : undefined;

export async function incrementAdViews(adId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  // Basic anti-abuse: one increment per session per ad
  try {
    const key = `viewed:${adId}`;
    if (viewSession?.getItem(key)) return;
    viewSession?.setItem(key, '1');
    await getSupabaseBrowser()!.rpc('increment_ad_views', { p_ad_id: adId });
  } catch {
    /* non-critical */
  }
}

/* ------------------------------------------------------------------ */
/* CREATE / SUBMIT                                                     */
/* ------------------------------------------------------------------ */

export interface SubmitInput {
  title: string;
  description: string;
  price: number;
  condition: string;
  categoryId: string | null;
  subcategoryId: string | null;
  locationId: string | null;
  locationLabel: string;
  attributes: Record<string, string>;
  contactShowPhone: boolean;
  contactShowWhatsapp: boolean;
  contactAllowMessages: boolean;
  images: { src: string; name: string }[]; // data URLs / blobs from wizard
  submitForReview: boolean;                 // false => stays draft
}

/** Creates or updates an ad then uploads its images to Storage.
 *  Returns the ad id. Throws on validation or DB failure. */
export async function saveAd(input: SubmitInput, existingAdId?: string): Promise<string> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');

  const payload = adSubmissionSchema.parse({
    title: input.title,
    description: input.description,
    price: input.price,
    condition: input.condition,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    locationId: input.locationId,
    attributes: input.attributes,
    contactShowPhone: input.contactShowPhone,
    contactShowWhatsapp: input.contactShowWhatsapp,
    contactAllowMessages: input.contactAllowMessages,
  });

  const slugBase = generateSlug(payload.title);
  let adId = existingAdId;

  if (!adId) {
    const { ensureUnique } = await resolveUniqueSlug(slugBase);
    const { data, error } = await sb
      .from('ads')
      .insert({
        user_id: auth.user.id,
        title: payload.title.trim(),
        slug: ensureUnique,
        description: payload.description.trim(),
        price: payload.price,
        condition: payload.condition,
        category_id: payload.categoryId,
        subcategory_id: payload.subcategoryId,
        location_id: payload.locationId,
        attributes: payload.attributes,
        contact_show_phone: payload.contactShowPhone,
        contact_show_whatsapp: payload.contactShowWhatsapp,
        contact_allow_messages: payload.contactAllowMessages,
        status: input.submitForReview ? 'pending' : 'draft',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    adId = data.id;
  } else {
    // Owner edits always re-enter moderation (Option A)
    const { error } = await sb
      .from('ads')
      .update({
        title: payload.title.trim(),
        slug: slugBase,
        description: payload.description.trim(),
        price: payload.price,
        condition: payload.condition,
        category_id: payload.categoryId,
        subcategory_id: payload.subcategoryId,
        location_id: payload.locationId,
        attributes: payload.attributes,
        contact_show_phone: payload.contactShowPhone,
        contact_show_whatsapp: payload.contactShowWhatsapp,
        contact_allow_messages: payload.contactAllowMessages,
        status: input.submitForReview ? 'pending' : 'draft',
      })
      .eq('id', adId)
      .eq('user_id', auth.user.id);
    if (error) throw new Error(error.message);
  }

  await uploadImages(adId!, auth.user.id, input.images);
  return adId!;
}

async function resolveUniqueSlug(base: string): Promise<{ ensureUnique: string }> {
  const sb = getSupabaseBrowser()!;
  let candidate = base;
  let n = 2;
  // Loop guarded by unique constraint; small bounded retry
  for (let i = 0; i < 5; i++) {
    const { data } = await sb.from('ads').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return { ensureUnique: candidate };
    candidate = `${base}-${n++}`;
  }
  return { ensureUnique: `${base}-${Date.now().toString(36)}` };
}

/* ------------------------------------------------------------------ */
/* IMAGE UPLOADS — storage path: uid/ad-id/name.webp                   */
/* ------------------------------------------------------------------ */

export async function uploadImages(
  adId: string,
  userId: string,
  images: { src: string; name: string }[]
): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');

  const { compressImage } = await import('@/lib/images');

  for (let i = 0; i < Math.min(images.length, 10); i++) {
    const img = images[i];
    let blob: Blob;
    try {
      blob = await (await fetch(img.src)).blob();
    } catch {
      continue;
    }
    const file = new File([blob], img.name || `photo-${i}.webp`, { type: blob.type });
    const compressed = await compressImage(file).catch(() => file);

    const path = `${userId}/${adId}/${i}-${Date.now()}.webp`;
    const { error: upErr } = await sb.storage.from('ad-images').upload(path, compressed, {
      contentType: 'image/webp',
      upsert: true,
    });
    if (upErr) throw new Error(`Image upload failed: ${upErr.message}`);

    const { data: urlData } = sb.storage.from('ad-images').getPublicUrl(path);

    // Only one primary image
    const { error: clearErr } = await sb
      .from('ad_images')
      .update({ is_primary: false })
      .eq('ad_id', adId);
    if (clearErr) throw new Error(clearErr.message);

    const { error: dbErr } = await sb.from('ad_images').upsert({
      ad_id: adId,
      image_url: urlData.publicUrl,
      storage_path: path,
      sort_order: i,
      is_primary: i === 0,
    });
    if (dbErr) throw new Error(dbErr.message);
  }
}

export async function deleteImage(storagePath: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.storage.from('ad-images').remove([storagePath]);
  await sb.from('ad_images').delete().eq('storage_path', storagePath);
}

/* ------------------------------------------------------------------ */
/* OWNER ACTIONS                                                       */
/* ------------------------------------------------------------------ */

export async function setAdStatus(adId: string, status: 'pending' | 'sold' | 'deleted'): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  if (status === 'deleted') {
    const { error } = await sb.from('ads').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', adId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await sb.from('ads').update({ status }).eq('id', adId);
  if (error) throw new Error(error.message);
}

export async function renewAd(adId: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  // Renewal returns an approved ad to pending for a fresh review window
  const { error } = await sb
    .from('ads')
    .update({ status: 'pending', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() })
    .eq('id', adId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* MY ADS                                                              */
/* ------------------------------------------------------------------ */

export interface MyAdRow {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  status: DbAdStatus;
  views: number;
  enquiries: number;
  createdAt: string;
  rejectionReason?: string | null;
}

export async function getMyAds(): Promise<MyAdRow[]> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    // Mock fallback mirrors demo dashboard rows
    return demoAds.map((d) => ({
      id: d.id, slug: d.title.toLowerCase().replace(/\W+/g, '-').slice(0, 50), title: d.title,
      image: d.image, price: d.price, status: d.status.toLowerCase() as DbAdStatus,
      views: d.views, enquiries: d.enquiries, createdAt: d.createdAt,
    }));
  }
  const { data, error } = await sb
    .from('ads')
    .select(`id, slug, title, price, status, views_count, rejection_reason, created_at,
             ad_images(image_url, is_primary, sort_order)`)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    image: (row.ad_images || []).find((i: any) => i.is_primary)?.image_url || '',
    price: Number(row.price ?? 0),
    status: row.status,
    views: row.views_count,
    enquiries: 0,
    createdAt: new Date(row.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    rejectionReason: row.rejection_reason,
  }));
}

/* ------------------------------------------------------------------ */
/* DASHBOARD STATS                                                     */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  total: number; active: number; pending: number;
  views: number; favorites: number; messages: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    return { total: demoAds.length, active: demoAds.filter((d) => d.status === 'Active').length,
      pending: demoAds.filter((d) => d.status === 'Pending').length,
      views: demoAds.reduce((s, d) => s + d.views, 0), favorites: 12, messages: 3 };
  }
  const { data, error } = await sb
    .from('ads')
    .select('status, views_count, favorites_count')
    .neq('status', 'deleted');
  if (error) throw new Error(error.message);
  const rows = data || [];

  const { data: authData } = await sb.auth.getUser();
  if (!authData.user) {
    return { total: rows.length, active: 0, pending: 0, views: 0, favorites: 0, messages: 0 };
  }
  const uid = authData.user.id;

  // Real unread message count across my conversations
  let messages = 0;
  const { data: convs } = await sb
    .from('conversations')
    .select('id')
    .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`);
  if (convs && convs.length > 0) {
    const { count } = await sb
      .from('messages')
      .select('id', { count: 'exact' })
      .in('conversation_id', convs.map((c: any) => c.id))
      .neq('sender_id', uid)
      .eq('is_read', false);
    messages = count ?? 0;
  }

  return {
    total: rows.length,
    active: rows.filter((r: any) => r.status === 'approved').length,
    pending: rows.filter((r: any) => r.status === 'pending' || r.status === 'draft').length,
    views: rows.reduce((s: number, r: any) => s + (r.views_count || 0), 0),
    favorites: rows.reduce((s: number, r: any) => s + (r.favorites_count || 0), 0),
    messages,
  };
}

/* ------------------------------------------------------------------ */
/* ADMIN MODERATION                                                    */
/* ------------------------------------------------------------------ */

export interface AdminAdRow {
  id: string; slug: string; title: string; image: string;
  seller: string; category: string; location: string;
  status: DbAdStatus; date: string; price: number; description: string;
}

export async function adminListAds(statusFilter?: string): Promise<AdminAdRow[]> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    const { adminAds } = await import('@/data/adminData');
    return adminAds.map((a) => ({
      id: a.id, slug: a.id, title: a.title, image: a.image, seller: a.seller,
      category: a.category, location: a.location,
      status: a.status.toLowerCase() as DbAdStatus, date: a.date, price: a.price, description: a.description,
    }));
  }
  let q = sb
    .from('ads')
    .select(`id, slug, title, price, status, description, created_at,
             profiles:name(user_id, name), categories(name), locations(name),
             ad_images(image_url, is_primary)`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (statusFilter && statusFilter !== 'All') q = q.eq('status', statusFilter.toLowerCase());

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    image: (row.ad_images || []).find((i: any) => i.is_primary)?.image_url || '',
    seller: row.profiles?.name ?? '—',
    category: row.categories?.name ?? '—',
    location: row.locations?.name ?? '—',
    status: row.status,
    date: new Date(row.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    price: Number(row.price ?? 0),
    description: row.description,
  }));
}

const REASONS = [
  'Incorrect category', 'Missing information', 'Duplicate advertisement',
  'Suspicious content', 'Prohibited content', 'Poor quality', 'Other',
];

export async function moderateAd(
  ad: { id: string; title: string },
  action: 'approve' | 'reject',
  reason?: string
): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  if (action === 'reject' && (!reason || !REASONS.includes(reason))) {
    throw new Error('A valid rejection reason is required');
  }

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');

  const patch =
    action === 'approve'
      ? { status: 'approved', published_at: new Date().toISOString(), rejection_reason: null }
      : { status: 'rejected', rejection_reason: reason };

  // RLS guard_ad_update allows admins privileged transitions
  const { error } = await sb.from('ads').update(patch).eq('id', ad.id);
  if (error) throw new Error(error.message);

  // Audit log
  await sb.from('admin_audit_logs').insert({
    admin_id: auth.user.id,
    action: action === 'approve' ? 'ad_approved' : 'ad_rejected',
    entity_type: 'ad',
    entity_id: ad.id,
    metadata: { reason: reason ?? null },
  });

  // Notify seller — need owner id + slug for click-through
  const { data: row } = await sb.from('ads').select('user_id, slug').eq('id', ad.id).single();
  if (row) {
    await sb.rpc('notify_user', {
      p_user: row.user_id,
      p_type: action === 'approve' ? 'ad_approved' : 'ad_rejected',
      p_title: action === 'approve'
        ? 'Your advertisement has been approved and is now live.'
        : `Your advertisement was rejected because: ${reason}`,
      p_body: ad.title,
      p_data: { ad_slug: row.slug },
    });
  }
}

/* ------------------------------------------------------------------ */
/* FAVORITES                                                           */
/* ------------------------------------------------------------------ */

export async function toggleFavorite(adId: string): Promise<boolean> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error('BACKEND_NOT_CONFIGURED');
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('NOT_AUTHENTICATED');

  const { data: existing } = await sb
    .from('favorites')
    .select('user_id')
    .eq('ad_id', adId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (existing) {
    await sb.from('favorites').delete().eq('ad_id', adId).eq('user_id', auth.user.id);
    return false;
  }
  await sb.from('favorites').insert({ ad_id: adId, user_id: auth.user.id });
  return true;
}

export async function getFavoriteState(adId: string): Promise<boolean> {
  const sb = getSupabaseBrowser();
  if (!sb) return false;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return false;
  const { data } = await sb.from('favorites').select('user_id').eq('ad_id', adId).eq('user_id', auth.user.id).maybeSingle();
  return !!data;
}

export async function getMyFavoriteAds(): Promise<PublicAd[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return [];
  const { data: favs, error } = await sb
    .from('favorites')
    .select(`ad_id, ads(*, categories(name, slug), locations(name),
             profiles:user_id(name, is_verified, phone, whatsapp),
             ad_images(image_url, is_primary, sort_order))`)
    .order('created_at', { ascending: false });
  if (error || !favs) return [];
  return favs
    .map((f: any) => (f.ads ? mapRowToPublicAd(f.ads) : null))
    .filter(Boolean) as PublicAd[];
}

/* ------------------------------------------------------------------ */
/* CATEGORIES & LOCATIONS                                              */
/* ------------------------------------------------------------------ */

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  children: CategoryNode[];
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    // Fallback: derive from existing taxonomy so dev works pre-seed
    const { detailedCategories } = await import('@/data/taxonomy');
    return detailedCategories.map((c) => ({
      id: c.slug, name: c.name, slug: c.slug, icon: c.icon,
      children: c.subcategories.map((s) => ({ id: s.slug, name: s.name, slug: s.slug, children: [] })),
    }));
  }
  const { data, error } = await sb
    .from('categories')
    .select('id, parent_id, name, slug, icon')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new Error(error.message);
  const all = data || [];
  const roots = all.filter((c: any) => !c.parent_id);
  return roots.map((c: any) => ({
    id: c.id, name: c.name, slug: c.slug, icon: c.icon,
    children: all.filter((s: any) => s.parent_id === c.id).map((s: any) => ({ id: s.id, name: s.name, slug: s.slug, children: [] })),
  }));
}

export interface LocationNode {
  id: string;
  name: string;
  slug: string;
  level: string;
  children: LocationNode[];
}

export async function getLocationTree(): Promise<LocationNode[]> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    // Fallback mirrors country-state-city India subset
    const { Country, State, City } = await import('country-state-city');
    return Country.getAllCountries().slice(0, 25).map((c) => ({
      id: c.isoCode, name: c.name, slug: c.isoCode, level: 'country',
      children: State.getStatesOfCountry(c.isoCode).map((s) => ({
        id: `${c.isoCode}:${s.isoCode}`, name: s.name, slug: s.isoCode, level: 'state',
        children: City.getCitiesOfState(c.isoCode, s.isoCode).slice(0, 20).map((ct) => ({
          id: ct.name, name: ct.name, slug: ct.name, level: 'city', children: [],
        })),
      })),
    }));
  }
  const { data, error } = await sb.from('locations').select('id, parent_id, name, slug, level');
  if (error) throw new Error(error.message);
  const all = data || [];
  const build = (parentId: string | null, level: string): LocationNode[] =>
    all
      .filter((l: any) => l.parent_id === parentId)
      .map((l: any) => ({ id: l.id, name: l.name, slug: l.slug, level, children: build(l.id, nextLevel(level)) }));
  return build(null, 'country');
}

function nextLevel(level: string): string {
  return level === 'country' ? 'state' : level === 'state' ? 'city' : 'locality';
}

/* ------------------------------------------------------------------ */
/* NOTIFICATIONS                                                       */
/* ------------------------------------------------------------------ */

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  time: string;
}

export async function getMyNotifications(): Promise<AppNotification[]> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    const { notifications } = await import('@/data/accountData');
    return notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, read: !n.unread, time: n.time }));
  }
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data || []).map((n: any) => ({
    id: n.id, type: n.type, title: n.title, body: n.body, read: n.read,
    time: new Date(n.created_at).toLocaleString('en-IN'),
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const sb = getSupabaseBrowser();
  if (!sb) return;
  await sb.from('notifications').update({ read: true }).eq('id', id);
}

/* ------------------------------------------------------------------ */
/* MOCK SHIM                                                           */
/* ------------------------------------------------------------------ */

function mockAsPublic(): PublicAd[] {
  return [...mockListings, ...mockListings].map((l, idx) => ({
    id: l.id,
    slug: generateSlug(l.title) || `ad-${idx}`,
    title: l.title,
    description: l.description,
    price: l.price,
    condition: l.condition,
    images: l.images.map((url, i) => ({ url, isPrimary: i === 0, sortOrder: i })),
    categoryName: l.category,
    categorySlug: l.categorySlug,
    locationLabel: l.location,
    city: l.city,
    attributes: {},
    createdAt: new Date().toISOString(),
    viewsCount: l.views,
    favoritesCount: l.favorites,
    isFeatured: l.featured,
    status: 'approved',
    seller: {
      id: l.seller.name,
      name: l.seller.name,
      verified: l.seller.verified,
      showPhone: true,
      showWhatsApp: true,
      allowMessages: true,
      email: l.contactEmail,
    },
  })).filter((ad, i, arr) => arr.findIndex((a) => a.slug === ad.slug) === i);
}