import { z } from 'zod';

export const CONDITIONS = ['new', 'used_like_new', 'used_good', 'used_fair'] as const;
export type ConditionValue = (typeof CONDITIONS)[number];

export const adDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(8, 'Title must be at least 8 characters')
    .max(80, 'Title must be at most 80 characters'),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description must be at most 2000 characters'),
  price: z
    .number({ message: 'Price must be a number' })
    .nonnegative('Price cannot be negative')
    .max(9_999_999_999),
  condition: z.enum(CONDITIONS),
  categorySlug: z.string().min(1, 'Category is required'),
  subcategoryName: z.string().optional(),
});

export const adLocationSchema = z.object({
  countryIso: z.string().min(1, 'Country is required'),
  stateIso: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City is required'),
  locality: z.string().trim().max(120).optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
});

export const phoneSchema = z
  .string()
  .regex(/^[+\d][\d\s-]{7,14}$/, 'Enter a valid phone number');

export const contactSchema = z.object({
  contactEmail: z.string().email('Valid email required'),
  showPhone: z.boolean(),
  showWhatsApp: z.boolean(),
  allowMessages: z.boolean(),
});

export const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_IMAGES = 10;
export const MAX_IMAGE_MB = 10;

export const imageFileSchema = z
  .instanceof(File)
  .refine((f) => IMAGE_TYPES.includes(f.type), 'Only JPG, PNG or WEBP images are allowed')
  .refine((f) => f.size <= MAX_IMAGE_MB * 1024 * 1024, `Max ${MAX_IMAGE_MB}MB per image`);

export function validateImages(files: File[]): { ok: boolean; error?: string } {
  if (files.length === 0) return { ok: false, error: 'Add at least one photo.' };
  if (files.length > MAX_IMAGES) return { ok: false, error: `Maximum ${MAX_IMAGES} images allowed.` };
  for (const f of files) {
    const r = imageFileSchema.safeParse(f);
    if (!r.success) return { ok: false, error: r.error.issues[0].message };
  }
  return { ok: true };
}

/** Server-boundary payload — re-validated before any DB write. */
export const adSubmissionSchema = z.object({
  title: adDetailsSchema.shape.title,
  description: adDetailsSchema.shape.description,
  price: adDetailsSchema.shape.price,
  condition: adDetailsSchema.shape.condition,
  categoryId: z.string().uuid().nullable(),
  subcategoryId: z.string().uuid().nullable(),
  locationId: z.string().uuid().nullable(),
  attributes: z.record(z.string(), z.string()).default({}),
  contactShowPhone: z.boolean().default(false),
  contactShowWhatsapp: z.boolean().default(false),
  contactAllowMessages: z.boolean().default(true),
});

export type AdSubmission = z.infer<typeof adSubmissionSchema>;