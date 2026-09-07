export function getAdUrl(slug: string): string {
  if (!slug || typeof slug !== 'string') {
    throw new Error('getAdUrl: slug is required');
  }
  return `/ad/${encodeURIComponent(slug)}`;
}
