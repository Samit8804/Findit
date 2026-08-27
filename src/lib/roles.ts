export type Role = 'user' | 'moderator' | 'admin' | 'super_admin';

export const ROLE_HIERARCHY: Record<Role, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
  super_admin: 3,
};

export function can(actorRole: Role, required: Role): boolean {
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[required];
}

export const PERMISSIONS = {
  moderateAds: 'moderator' as Role,
  reviewReports: 'moderator' as Role,
  suspendAds: 'moderator' as Role,
  viewUsers: 'moderator' as Role,
  viewBusinesses: 'moderator' as Role,
  managePayments: 'admin' as Role,
  managePromotions: 'admin' as Role,
  manageUsers: 'admin' as Role,
  manageCategories: 'admin' as Role,
  manageLocations: 'admin' as Role,
  manageAdvertising: 'admin' as Role,
  manageSeo: 'admin' as Role,
  viewAuditLogs: 'admin' as Role,
  manageRoles: 'super_admin' as Role,
  systemSettings: 'super_admin' as Role,
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return can(role, PERMISSIONS[permission]);
}
