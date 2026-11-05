import { db } from '@/lib/db';
import { requireStaffPage, type SessionUser } from '@/lib/auth/session';
import { permissionsFor, type Permission, PERMISSIONS } from '@/lib/rbac';

/** Enforces a permission for an admin page and returns the viewer with their permission set. */
export async function adminContext(permission: Permission = PERMISSIONS.OVERVIEW_VIEW): Promise<{ user: SessionUser; perms: Set<string> }> {
  const user = await requireStaffPage(permission);
  const perms = await permissionsFor(user.id);
  return { user, perms };
}

/** Monthly confirmed donation totals for the last N months, oldest first. */
export async function monthlyDonations(months = 6) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));
  const rows = await db.donation.findMany({
    where: { status: 'SUCCESS', paidAt: { gte: start } },
    select: { paidAt: true, amountPaise: true },
  });
  const buckets: { label: string; paise: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    buckets.push({ label: d.toLocaleString('en-IN', { month: 'short' }), paise: 0 });
  }
  for (const r of rows) {
    if (!r.paidAt) continue;
    const idx = (r.paidAt.getFullYear() - start.getFullYear()) * 12 + (r.paidAt.getMonth() - start.getMonth());
    if (idx >= 0 && idx < buckets.length) buckets[idx].paise += r.amountPaise;
  }
  return buckets;
}

/** Donation totals grouped by category, for the analytics screen. */
export async function donationsByCategory() {
  const cats = await db.campaignCategory.findMany({
    select: { name: true, campaigns: { select: { donations: { where: { status: 'SUCCESS' }, select: { amountPaise: true } } } } },
    orderBy: { sortOrder: 'asc' },
  });
  return cats.map((c) => ({
    name: c.name,
    paise: c.campaigns.reduce((s, camp) => s + camp.donations.reduce((t, d) => t + d.amountPaise, 0), 0),
    count: c.campaigns.reduce((s, camp) => s + camp.donations.length, 0),
  }));
}
