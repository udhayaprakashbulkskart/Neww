// Role-based permissions for the admin and merchant dashboards.

export const PERMISSIONS = [
  'users:read', 'users:suspend',
  'membership:manage',
  'orders:read', 'orders:transition',
  'commissions:run', 'commissions:read',
  'withdrawals:read', 'withdrawals:decide',
  'merchants:manage', 'coupons:manage', 'merchant:own',
  'ads:review', 'ads:fund',
  'fx:manage',
  'fraud:review',
  'audit:read',
  'finance:read',
  'milestones:manage', 'milestones:decide',
  'kyc:review',
  'spin:manage', 'spin:redeem',
  'payments:confirm',
  'staff:manage',
  'campaigns:own',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type StaffRole = 'MEMBER' | 'ADMIN' | 'FINANCE' | 'SUPPORT' | 'MERCHANT' | 'ADVERTISER';

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  MEMBER: [],
  ADMIN: PERMISSIONS,
  FINANCE: ['withdrawals:read', 'withdrawals:decide', 'commissions:read', 'commissions:run', 'orders:read', 'ads:fund', 'fx:manage', 'audit:read', 'finance:read', 'milestones:decide', 'kyc:review', 'spin:redeem', 'payments:confirm'],
  SUPPORT: ['users:read', 'orders:read', 'fraud:review'],
  MERCHANT: ['merchant:own', 'orders:read'],
  ADVERTISER: ['campaigns:own'],
};

export function can(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
