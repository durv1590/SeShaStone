import { Role } from '@prisma/client';

/** Fine-grained admin permissions. Controllers declare what they need via @RequirePermissions. */
export const PERMISSIONS = [
  'dashboard.view',
  'orders.view',
  'orders.manage',
  'payments.view',
  'payments.verify',
  'refunds.manage',
  'customers.view',
  'customers.manage',
  'products.view',
  'products.manage',
  'inventory.manage',
  'reviews.moderate',
  'marketing.manage',
  'content.manage',
  'media.upload',
  'settings.view',
  'settings.business.edit',
  'settings.payment.edit',
  'audit.view',
  'users.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ORDER_MANAGER: Permission[] = [
  'dashboard.view',
  'orders.view',
  'orders.manage',
  'payments.view',
  'payments.verify',
  'refunds.manage',
  'customers.view',
  'products.view',
];
const PRODUCT_MANAGER: Permission[] = [
  'dashboard.view',
  'products.view',
  'products.manage',
  'inventory.manage',
  'media.upload',
  'reviews.moderate',
];

/** Least-privilege role → permission map. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CUSTOMER: [],
  SUPPORT: ['dashboard.view', 'orders.view', 'payments.view', 'customers.view', 'products.view', 'reviews.moderate'],
  ORDER_MANAGER,
  PRODUCT_MANAGER,
  MARKETING_MANAGER: [
    'dashboard.view',
    'products.view',
    'marketing.manage',
    'content.manage',
    'media.upload',
    'reviews.moderate',
  ],
  STAFF: [...new Set([...ORDER_MANAGER, ...PRODUCT_MANAGER])],
  ADMIN: PERMISSIONS.filter((p) => p !== 'users.manage'),
  SUPER_ADMIN: PERMISSIONS,
};

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/** Any role other than CUSTOMER may sign in to the admin panel. */
export const STAFF_ROLES: Role[] = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((r) => r !== 'CUSTOMER');
