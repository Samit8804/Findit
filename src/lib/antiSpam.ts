import { getSupabaseBrowser } from '@/lib/supabase/client';

/** Basic duplicate detection: same seller + category + similar title/desc/price/location */
export async function detectPotentialDuplicate(input: {
  userId: string;
  title: string;
  description: string;
  categoryId: string | null;
  locationId: string | null;
  price: number | null;
}): Promise<{ isDuplicate: boolean; reason?: string }> {
  const sb = getSupabaseBrowser();
  if (!sb) return { isDuplicate: false };
  const { data } = await sb
    .from('ads')
    .select('title, description, price, category_id, location_id')
    .eq('user_id', input.userId)
    .in('status', ['pending', 'approved'])
    .limit(20);
  if (!data) return { isDuplicate: false };
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const ad of data) {
    const titleSim = jaccard(norm(ad.title), norm(input.title));
    const descSim = jaccard(norm(ad.description), norm(input.description));
    const sameCategory = ad.category_id === input.categoryId;
    const sameLocation = ad.location_id === input.locationId;
    const priceClose = ad.price && input.price
      ? Math.abs(Number(ad.price) - Number(input.price)) / Math.max(Number(ad.price), 1) < 0.05
      : false;
    if (titleSim > 0.85 && descSim > 0.75 && sameCategory && sameLocation) {
      return { isDuplicate: true, reason: 'Near-identical title/description in same category and location' };
    }
    if (titleSim > 0.9 && priceClose) {
      return { isDuplicate: true, reason: 'Very similar title and price to a recent listing' };
    }
  }
  return { isDuplicate: false };
}

function jaccard(a: string, b: string): number {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const inter = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter / union;
}

const PROHIBITED_FALLBACK = ['weapon', 'counterfeit', 'stolen', 'escort', 'casino'];

export async function checkProhibitedContent(title: string, description: string): Promise<string[]> {
  const sb = getSupabaseBrowser();
  let keywords: string[] = PROHIBITED_FALLBACK;
  if (sb) {
    const { data } = await sb.from('prohibited_keywords').select('keyword');
    if (data && data.length) keywords = data.map((k: any) => k.keyword.toLowerCase());
  }
  const text = `${title} ${description}`.toLowerCase();
  return keywords.filter((kw) => text.includes(kw));
}

export function hasExcessiveLinks(text: string, maxLinks = 3): boolean {
  const links = (text.match(/https?:\/\/|www\./gi) || []).length;
  return links > maxLinks;
}

export function hasContactAbuse(phones: string[]): boolean {
  // If same phone appears in many ads quickly, flag (checked server-side via count)
  return false; // server check in trigger/service
}

/** Risk score 0-100, private, for moderation prioritization */
export function computeRiskScore(input: {
  accountAgeDays: number;
  rejectedCount: number;
  reportCount: number;
  duplicateFlag: boolean;
  spamLinks: boolean;
  keywordFlags: number;
}): number {
  let score = 0;
  if (input.accountAgeDays < 7) score += 20;
  else if (input.accountAgeDays < 30) score += 10;
  score += Math.min(input.rejectedCount * 8, 24);
  score += Math.min(input.reportCount * 10, 20);
  if (input.duplicateFlag) score += 15;
  if (input.spamLinks) score += 10;
  score += Math.min(input.keywordFlags * 12, 24);
  return Math.min(score, 100);
}
