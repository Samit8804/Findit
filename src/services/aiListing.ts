import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { AiLanguage, AiTarget } from '@/lib/ai/listingAssistant';

export interface AiListingRequest {
  target: AiTarget;
  language: AiLanguage;
  category: string;
  itemName: string;
  currentTitle?: string;
  currentDescription?: string;
  brand?: string;
  model?: string;
  condition?: 'new' | 'used_like_new' | 'used_good' | 'used_fair';
  ageOrPurchase?: string;
  price?: number;
  location?: string;
  details?: string;
}

export type AiReferenceStatus = 'ok' | 'unavailable';

export interface AiListingResult {
  title?: string;
  description?: string;
  language: AiLanguage;
  missing_details: string[];
  questions: string[];
  reference_count: number;
  reference_status: AiReferenceStatus;
}

function stringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export async function generateAiListing(
  input: AiListingRequest,
  options: { signal?: AbortSignal } = {}
): Promise<AiListingResult> {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error('AI service is not available right now.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Please log in to use the AI listing assistant.');

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
    signal: options.signal,
  });

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'AI could not generate your listing. Please try again.';
    throw new Error(message);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('AI returned an invalid response. Please try again.');
  }

  const result = data as Record<string, unknown>;
  if (result.language !== 'en' && result.language !== 'hi') {
    throw new Error('AI returned an invalid response. Please try again.');
  }
  if (result.title !== undefined && (typeof result.title !== 'string' || result.title.length > 80)) {
    throw new Error('AI returned an invalid title. Please try again.');
  }
  if (
    result.description !== undefined &&
    (typeof result.description !== 'string' || result.description.length > 2000)
  ) {
    throw new Error('AI returned an invalid description. Please try again.');
  }

  return {
    title: typeof result.title === 'string' ? result.title.trim() : undefined,
    description: typeof result.description === 'string' ? result.description.trim() : undefined,
    language: result.language,
    missing_details: stringList(result.missing_details, 8),
    questions: stringList(result.questions, 5),
    reference_count:
      typeof result.reference_count === 'number' && Number.isFinite(result.reference_count)
        ? Math.max(0, Math.floor(result.reference_count))
        : 0,
    reference_status: result.reference_status === 'unavailable' ? 'unavailable' : 'ok',
  };
}
