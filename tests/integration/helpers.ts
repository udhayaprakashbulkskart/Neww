import { db } from '@/lib/db';
import { encryptText, keyedHash } from '@/lib/crypto';
import { syncRbac } from '@/lib/rbac';

/** Wipes all application tables. Only ever run against the dedicated test database. */
export async function resetDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('helptrust_test')) throw new Error('Refusing to reset a non-test database.');
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "PostFee", "WebhookEvent", "Refund", "Payment", "Donation", "SavedCampaign", "CampaignUpdate", "CampaignDocument",
      "FraudReport", "Complaint", "Notification", "AdminAuditLog", "PlatformSetting", "VerificationReview",
      "Verification", "BankVerification", "Campaign", "CampaignCategory", "UserRole", "UserProfile",
      "RolePermission", "Role", "Permission", "User"
    RESTART IDENTITY CASCADE
  `);
  await syncRbac();
}

let seq = 0;
export async function makeUser(opts: { fullName?: string; userType?: 'BENEFICIARY' | 'DONOR' | 'BOTH'; roles?: string[]; mobile?: string } = {}) {
  seq += 1;
  const mobile = opts.mobile ?? `9${String(700000000 + seq + Math.floor(Math.random() * 1e6)).padStart(9, '0')}`.slice(0, 10);
  const user = await db.user.create({
    data: {
      mobileHash: keyedHash(mobile, 'mobile'),
      mobileEncrypted: encryptText(mobile),
      mobileLast4: mobile.slice(-4),
      fullName: opts.fullName ?? `Test Person ${seq}`,
      userType: opts.userType ?? 'DONOR',
      status: 'ACTIVE',
      mobileVerifiedAt: new Date(),
      profile: { create: {} },
    },
  });
  for (const key of opts.roles ?? []) {
    const role = await db.role.findUniqueOrThrow({ where: { key } });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }
  return { ...user, mobile };
}

export async function makeCategory(slug = 'medical') {
  return db.campaignCategory.upsert({
    where: { slug },
    update: {},
    create: { slug, name: slug.replace(/-/g, ' '), icon: 'heart', tone: 'mint', sortOrder: 1 },
  });
}

export async function makeCampaign(args: {
  beneficiaryId: string;
  status?: 'DRAFT' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'CLOSED';
  requestedPaise?: number;
  raisedPaise?: number;
  title?: string;
  city?: string;
  slug?: string;
}) {
  const category = await makeCategory();
  const requested = args.requestedPaise ?? 1_500_000;
  const raised = args.raisedPaise ?? 0;
  const n = ++seq;
  return db.campaign.create({
    data: {
      slug: args.slug ?? `test-campaign-${n}-${Math.random().toString(36).slice(2, 7)}`,
      title: args.title ?? `Test campaign for family ${n}`,
      story: 'A test story that is long enough to satisfy the validation rules for a campaign description.',
      beneficiaryId: args.beneficiaryId,
      categoryId: category.id,
      city: args.city ?? 'Coimbatore',
      state: 'Tamil Nadu',
      status: args.status ?? 'PUBLISHED',
      requestedPaise: requested,
      raisedPaise: raised,
      fundingPercent: Math.min(100, Math.round((raised / requested) * 100)),
      totalDebtPaise: requested * 2,
      remainingPaise: requested * 2,
      publishedAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
}
