import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// Environment check - API key must be server-side only
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Request validation schema
const AiGenerateRequestSchema = z.object({
  task: z.enum(['generate', 'improve']),
  language: z.enum(['en', 'hi']),
  category: z.string().min(1).max(100),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  price: z.number().min(0).max(100000000).optional(),
  condition: z.enum(['new', 'used_like_new', 'used_good', 'used_fair']).optional(),
  location: z.string().min(1).max(200).optional(),
  brand: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

// Response validation schema
const AiGenerateResponseSchema = z.object({
  titles: z.array(z.string().min(1).max(200)).length(3),
  description: z.string().min(1).max(5000),
  highlights: z.array(z.string().min(1).max(200)),
  keywords: z.array(z.string().min(1).max(100)).max(20),
  missingDetails: z.array(z.string().min(1).max(200)).optional(),
});

function isConfigured(): boolean {
  return Boolean(OPENAI_API_KEY && OPENAI_API_KEY.trim().length > 0);
}

function buildSystemPrompt(task: string, language: string): string {
  const lang = language === 'hi' ? 'Hindi (Devanagari script)' : 'English';
  const preserveNote = `IMPORTANT: Preserve all brand names, product model numbers, technical specifications, and numerical values exactly as provided. Do not translate or alter them. Keep prices and numerical details consistent with supplied facts.`;

  if (task === 'generate') {
    return `You are an expert classified ads copywriter. Generate a complete listing in ${lang}.

${preserveNote}

Generate exactly:
1. Three distinct title options (each max 200 characters)
2. One clear, well-organized description (max 5000 characters)
3. Key highlights (5-10 short points, each max 200 characters)
4. Relevant search keywords (up to 20 keywords, each max 100 characters)
5. Optional suggestions for genuinely missing details

Output ONLY valid JSON matching this schema:
{
  titles: string[],
  description: string,
  highlights: string[],
  keywords: string[],
  missingDetails?: string[]
}

Do not invent product facts, warranty coverage, ownership history, discounts, condition, location, or other claims. If information is missing, include suggestions in missingDetails rather than making assumptions.`;
  } else {
    return `You are an expert classified ads copywriter. Improve the provided listing in ${lang}.

${preserveNote}

Preserve the original meaning and all factual information. Do not invent specifications, warranty coverage, ownership history, discounts, condition, location, or other claims.

Generate exactly:
1. Three improved title options (each max 200 characters)
2. A rewritten description (max 5000 characters)
3. Key highlights (5-10 short points, each max 200 characters)
4. Relevant search keywords (up to 20 keywords, each max 100 characters)
5. Suggestions for clarity or completeness improvements

Output ONLY valid JSON matching this schema:
{
  titles: string[],
  description: string,
  highlights: string[],
  keywords: string[],
  missingDetails?: string[]
}

Do not invent product facts. If information is missing, include suggestions in missingDetails rather than making assumptions.`;
  }
}

function buildUserPrompt(task: string, input: any): string {
  const lines: string[] = [];
  if (input.category) lines.push(`Category: ${input.category}`);
  if (input.title) lines.push(`Current Title: ${input.title}`);
  if (input.description) lines.push(`Current Description: ${input.description}`);
  if (input.price !== undefined) lines.push(`Price: ${input.price}`);
  if (input.condition) lines.push(`Condition: ${input.condition}`);
  if (input.location) lines.push(`Location: ${input.location}`);
  if (input.brand) lines.push(`Brand: ${input.brand}`);
  if (input.model) lines.push(`Model: ${input.model}`);
  if (input.notes) lines.push(`Notes: ${input.notes}`);

  const taskName = task === 'generate' ? 'Generate a complete listing' : 'Improve this existing listing';
  return `${taskName} based on the following details:\n\n${lines.join('\n')}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  // Check API key configuration
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'AI service is not configured. Please set OPENAI_API_KEY environment variable.' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Validate request
  const validation = AiGenerateRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { task, language, ...input } = validation.data;

  try {
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(task, language) },
        { role: 'user', content: buildUserPrompt(task, input) },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'AI service returned empty response' },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'AI service returned invalid response format' },
        { status: 502 }
      );
    }

    // Validate response
    const responseValidation = AiGenerateResponseSchema.safeParse(parsed);
    if (!responseValidation.success) {
      return NextResponse.json(
        { error: 'AI service returned invalid output', details: responseValidation.error.flatten().fieldErrors },
        { status: 502 }
      );
    }

    return NextResponse.json(responseValidation.data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return NextResponse.json(
        { error: 'AI service rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return NextResponse.json(
        { error: 'AI service request timed out. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'AI service error. Please try again.' },
      { status: 500 }
    );
  }
}