/** Slug generation with safe uniqueness handled server-side
 *  (ensure_unique_slug SQL function appends -2, -3, ...). */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
}

export const MAX_STORED_IMAGE_KB = 500;

/**
 * Compress any image to WEBP under `maxKb` (default 500KB).
 * Progressively reduces quality then dimensions until it fits.
 * Canvas re-encode also strips EXIF/metadata.
 */
export async function compressImage(
  file: File | Blob,
  maxKb: number = MAX_STORED_IMAGE_KB
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const encode = async (scale: number, quality: number): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
        'image/webp',
        quality
      );
    });
  };

  // Already small enough?
  if (file.size <= maxKb * 1024) {
    const first = await encode(1, 0.85);
    if (first.size <= maxKb * 1024) return first;
  }

  const scales = [0.85, 0.7, 0.55, 0.45, 0.35];
  const qualities = [0.8, 0.7, 0.6, 0.5];

  let best: Blob = await encode(1, 0.8);
  if (best.size <= maxKb * 1024) return best;

  for (const scale of scales) {
    for (const q of qualities) {
      const candidate = await encode(scale, q);
      best = candidate.size < best.size ? candidate : best;
      if (candidate.size <= maxKb * 1024) return candidate;
    }
  }
  return best; // smallest we could achieve
}