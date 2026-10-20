import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
  AI_REQUEST_MAX_BYTES,
  SlidingWindowRateLimiter,
  aiListingRequestSchema,
  buildListingPrompt,
  parseAiJson,
  validateAiListingOutput,
} from '@/lib/ai/listingAssistant';
import { findReferenceListings } from '@/lib/ai/referenceSearch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const rateLimiter = new SlidingWindowRateLimiter(8, 10 * 60 * 1000);
const inFlight = new Set<string>();

function isConfigured(): boolean {
  return Boolean(OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0);
}

function bearerToken(request: Request): string {
  const value = request.headers.get('authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function errorResponse(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

function openAiFailure(error: unknown): NextResponse {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : 0;
  const message = error instanceof Error ? error.message : '';

  if (status === 429 || /rate limit|429/i.test(message)) {
    return errorResponse('AI is receiving too many requests. Please try again shortly.', 429);
  }
  if (status === 408 || /timeout|timed out|ETIMEDOUT/i.test(message)) {
    return errorResponse('AI took too long to respond. Please try again.', 504);
  }
  if (status === 401 || status === 403) {
    return errorResponse('AI service authentication failed. Please contact support.', 503);
  }
  return errorResponse('AI could not generate your listing. Please try again.', 502);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isConfigured()) {
    return errorResponse('AI service is not configured yet.', 503);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return errorResponse('AI service requires an authenticated account.', 503);
  }

  const token = bearerToken(request);
  if (!token) {
    return errorResponse('Please log in to use the AI listing assistant.', 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  let userId: string;
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return errorResponse('Your session has expired. Please log in again.', 401);
    }
    userId = authData.user.id;
  } catch {
    return errorResponse('Could not verify your session. Please try again.', 503);
  }

  const limit = rateLimiter.check(userId);
  if (!limit.allowed) {
    return errorResponse(
      'You have reached the AI generation limit. Please try again later.',
      429,
      { 'Retry-After': String(limit.retryAfterSeconds) }
    );
  }

  if (inFlight.has(userId)) {
    return errorResponse('An AI request is already running. Please wait for it to finish.', 409);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return errorResponse('Invalid request body.', 400);
  }
  if (new TextEncoder().encode(raw).length > AI_REQUEST_MAX_BYTES) {
    return errorResponse('The AI request is too large.', 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse('Invalid request body.', 400);
  }

  const validation = aiListingRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Please check the listing details and try again.',
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const input = validation.data;
  inFlight.add(userId);

  try {
    let references: Awaited<ReturnType<typeof findReferenceListings>> = [];
    try {
      references = await findReferenceListings(supabase, userId, input);
    } catch (referenceError) {
      console.error(
        '[ai/generate] reference search failed:',
        referenceError instanceof Error ? referenceError.message : 'unknown error'
      );
    }

    const prompt = buildListingPrompt(input, references);
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: 25_000,
      maxRetries: 0,
    });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.45,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return errorResponse('AI returned an empty response. Please try again.', 502);
    }

    let parsed: unknown;
    try {
      parsed = parseAiJson(content);
    } catch {
      return errorResponse('AI returned an unreadable response. Please try again.', 502);
    }

    const result = validateAiListingOutput(parsed, input.target, input.language);
    if (!result.ok) {
      return errorResponse(result.error, 502);
    }

    return NextResponse.json({
      ...(input.target === 'description' ? {} : { title: result.data.title }),
      ...(input.target === 'title' ? {} : { description: result.data.description }),
      language: result.data.language,
      missing_details: result.data.missing_details,
      questions: result.data.questions,
      reference_count: references.length,
    });
  } catch (error) {
    console.error(
      '[ai/generate] generation failed:',
      error instanceof Error ? error.message : 'unknown error'
    );
    return openAiFailure(error);
  } finally {
    inFlight.delete(userId);
  }
}
