import { db } from './db';
import { errors } from './http';

/**
 * Role-based access control. Roles and permissions are rows in the database so staff access can be
 * changed without a deploy. Keys below are the canonical permission names used in code.
 */
export const PERMISSIONS = {
  OVERVIEW_VIEW: 'overview.view',
  USER_VIEW: 'user.view',
  USER_SUSPEND: 'user.suspend',
  CAMPAIGN_VIEW: 'campaign.view',
  CAMPAIGN_REVIEW: 'campaign.review',
  CAMPAIGN_PUBLISH: 'campaign.publish',
  DOCUMENT_REVIEW: 'document.review',
  VERIFICATION_REVIEW: 'verification.review',
  DONATION_VIEW: 'donation.view',
  PAYMENT_VIEW: 'payment.view',
  REFUND_PROCESS: 'refund.process',
  FRAUD_MANAGE: 'fraud.manage',
  COMPLAINT_MANAGE: 'complaint.manage',
  REPORT_EXPORT: 'report.export',
  AUDIT_VIEW: 'audit.view',
  STAFF_MANAGE: 'staff.manage',
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_DEFINITIONS: Record<string, { name: string; description: string; permissions: Permission[] }> = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Full access, including staff management and settings.',
    permissions: Object.values(PERMISSIONS),
  },
  VERIFICATION_OFFICER: {
    name: 'Verification Officer',
    description: 'Reviews campaigns, documents and verification results.',
    permissions: [
      PERMISSIONS.OVERVIEW_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.CAMPAIGN_VIEW,
      PERMISSIONS.CAMPAIGN_REVIEW,
      PERMISSIONS.CAMPAIGN_PUBLISH,
      PERMISSIONS.DOCUMENT_REVIEW,
      PERMISSIONS.VERIFICATION_REVIEW,
    ],
  },
  FINANCE_OFFICER: {
    name: 'Finance Officer',
    description: 'Donations, payments, refunds and exports.',
    permissions: [
      PERMISSIONS.OVERVIEW_VIEW,
      PERMISSIONS.DONATION_VIEW,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.REFUND_PROCESS,
      PERMISSIONS.REPORT_EXPORT,
    ],
  },
  SUPPORT_AGENT: {
    name: 'Support Agent',
    description: 'Handles complaints and read-only user lookups.',
    permissions: [PERMISSIONS.OVERVIEW_VIEW, PERMISSIONS.USER_VIEW, PERMISSIONS.COMPLAINT_MANAGE],
  },
  FRAUD_ANALYST: {
    name: 'Fraud Analyst',
    description: 'Investigates flagged cases. Cannot suspend users without a Super Admin decision.',
    permissions: [PERMISSIONS.OVERVIEW_VIEW, PERMISSIONS.USER_VIEW, PERMISSIONS.CAMPAIGN_VIEW, PERMISSIONS.FRAUD_MANAGE, PERMISSIONS.AUDIT_VIEW],
  },
};

/** Returns the set of permission keys granted to a user through their roles. */
export async function permissionsFor(userId: string): Promise<Set<string>> {
  const rows = await db.userRole.findMany({
    where: { userId },
    select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
  });
  const set = new Set<string>();
  for (const r of rows) for (const p of r.role.permissions) set.add(p.permission.key);
  return set;
}

export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  return (await permissionsFor(userId)).has(permission);
}

export async function assertPermission(userId: string, permission: Permission): Promise<void> {
  if (!(await hasPermission(userId, permission))) throw errors.forbidden();
}

/** Used by the seed script and the admin "staff" screen to keep roles in sync with code. */
export async function syncRbac(): Promise<void> {
  const allPerms = Object.values(PERMISSIONS);
  for (const key of allPerms) {
    await db.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key.replace('.', ' ') },
    });
  }
  for (const [key, def] of Object.entries(ROLE_DEFINITIONS)) {
    const role = await db.role.upsert({
      where: { key },
      update: { name: def.name, description: def.description },
      create: { key, name: def.name, description: def.description },
    });
    const perms = await db.permission.findMany({ where: { key: { in: def.permissions } }, select: { id: true } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
}
