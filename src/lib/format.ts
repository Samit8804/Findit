export function formatINR(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return `₹${amount.toLocaleString('en-IN')}`;
}
