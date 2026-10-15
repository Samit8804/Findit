const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'help',
  'api',
  'login',
  'register',
  'dashboard',
  'settings',
  'messages',
  'system',
  'seller',
  'user',
  'business',
  'findit',
]);

export function getUsernameValidationError(username: string): string | null {
  if (username.length < 3 || username.length > 30) return 'Username must be 3-30 characters.';
  if (!/^[a-z0-9-]+$/.test(username)) return 'Only lowercase letters, numbers and hyphens.';
  if (username.startsWith('-') || username.endsWith('-')) return 'Cannot start or end with hyphen.';
  if (RESERVED_USERNAMES.has(username)) return 'This username is reserved.';
  return null;
}
