/**
 * Idempotent bootstrap for a fresh database: RBAC roles, campaign categories and, when requested,
 * a sandbox super-admin. Safe to run on every deploy. It creates no donations, campaigns or donors.
 *
 * BOOTSTRAP_SUPERADMIN_MOBILE and BOOTSTRAP_SUPERADMIN_PASSWORD create (or update) one super-admin account.
 */
import { PrismaClient } from '@prisma/client';
import { encryptText, keyedHash } from '../src/lib/crypto';
import { syncRbac } from '../src/lib/rbac';
import { hashPassword } from '../src/lib/password';

const db = new PrismaClient();

const CATEGORIES = [
  { slug: 'debt-relief', name: 'Debt Relief', icon: 'wallet', tone: 'yellow', sortOrder: 1 },
  { slug: 'medical', name: 'Medical', icon: 'heart', tone: 'sky', sortOrder: 2 },
  { slug: 'education', name: 'Education', icon: 'file', tone: 'pink', sortOrder: 3 },
  { slug: 'family', name: 'Family Support', icon: 'users', tone: 'mint', sortOrder: 4 },
  { slug: 'emergency', name: 'Emergency', icon: 'alert', tone: 'yellow', sortOrder: 5 },
  { slug: 'business', name: 'Business', icon: 'chart', tone: 'pink', sortOrder: 6 },
];

async function main() {
  await syncRbac();
  for (const c of CATEGORIES) {
    await db.campaignCategory.upsert({ where: { slug: c.slug }, update: c, create: c });
  }

  const mobile = process.env.BOOTSTRAP_SUPERADMIN_MOBILE?.replace(/\D/g, '');
  if (mobile) {
    if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('BOOTSTRAP_SUPERADMIN_MOBILE must be a 10-digit Indian mobile number.');
    const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
    if (!password || password.length < 12) throw new Error('BOOTSTRAP_SUPERADMIN_PASSWORD must be set (12+ characters).');
    const mobileHash = keyedHash(mobile, 'mobile');
    const passwordHash = await hashPassword(password);
    const user = await db.user.upsert({
      where: { mobileHash },
      update: { status: 'ACTIVE', passwordHash },
      create: {
        mobileHash,
        mobileEncrypted: encryptText(mobile),
        mobileLast4: mobile.slice(-4),
        fullName: 'Sandbox Super Admin',
        userType: 'DONOR',
        status: 'ACTIVE',
        passwordHash,
        profile: { create: { notifyEmail: false } },
      },
    });
    const role = await db.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id, assignedBy: 'bootstrap' },
    });
    console.info(`Bootstrap: super admin ready for mobile ending ${mobile.slice(-4)}.`);
  }
  console.info('Bootstrap complete.');
}

main()
  .catch((err) => {
    console.error('Bootstrap failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
