/**
 * Development seed. Creates RBAC roles, categories, staff and realistic DEMO data.
 * Refuses to run in production. Re-running is safe: every record is upserted by a stable key.
 *
 * Demo mobile numbers (sign in with OTP; in development the code is printed to the console):
 *   Super Admin           9000000001
 *   Verification Officer  9000000002
 *   Finance Officer       9000000003
 *   Support Agent         9000000004
 *   Fraud Analyst         9000000005
 *   Demo beneficiaries    9100000001 / 9100000002 / 9100000003 / 9100000004
 *   Demo donors           9200000001 / 9200000002
 */
import { PrismaClient } from '@prisma/client';
import { encryptText, keyedHash } from '../src/lib/crypto';
import { syncRbac } from '../src/lib/rbac';
import { slugify } from '../src/lib/format';

const db = new PrismaClient();

if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}

const CATEGORIES = [
  { slug: 'debt-relief', name: 'Debt Relief', icon: 'wallet', tone: 'yellow', sortOrder: 1 },
  { slug: 'medical', name: 'Medical', icon: 'heart', tone: 'sky', sortOrder: 2 },
  { slug: 'education', name: 'Education', icon: 'file', tone: 'pink', sortOrder: 3 },
  { slug: 'family', name: 'Family Support', icon: 'users', tone: 'mint', sortOrder: 4 },
  { slug: 'emergency', name: 'Emergency', icon: 'alert', tone: 'yellow', sortOrder: 5 },
  { slug: 'business', name: 'Business', icon: 'chart', tone: 'pink', sortOrder: 6 },
];

const STAFF = [
  { mobile: '9000000001', name: 'Demo Super Admin', roles: ['SUPER_ADMIN'] },
  { mobile: '9000000002', name: 'Demo Verification Officer', roles: ['VERIFICATION_OFFICER'] },
  { mobile: '9000000003', name: 'Demo Finance Officer', roles: ['FINANCE_OFFICER'] },
  { mobile: '9000000004', name: 'Demo Support Agent', roles: ['SUPPORT_AGENT'] },
  { mobile: '9000000005', name: 'Demo Fraud Analyst', roles: ['FRAUD_ANALYST'] },
];

const BENEFICIARIES = [
  { mobile: '9100000001', name: 'Murugan Ramasamy', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001', address: '12 Gandhipuram Cross Street' },
  { mobile: '9100000002', name: 'Lakshmi Devi Selvam', city: 'Madurai', state: 'Tamil Nadu', pincode: '625001', address: '4 Anna Nagar Main Road' },
  { mobile: '9100000003', name: 'Priya Sundaram', city: 'Chennai', state: 'Tamil Nadu', pincode: '600042', address: '28 Velachery Lake View' },
  { mobile: '9100000004', name: 'Arjun Kumar Nair', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', address: '7 Koramangala 5th Block' },
];

const DONORS = [
  { mobile: '9200000001', name: 'Kavya Iyer' },
  { mobile: '9200000002', name: 'Rohan Mehta' },
];

const CAMPAIGNS = [
  {
    slug: 'demo-help-clear-shop-loan',
    title: 'Help me clear my shop loan after the flood',
    beneficiary: '9100000001',
    category: 'business',
    story:
      'My small provision shop was flooded last monsoon. I lost stock worth more than the loan I had taken to start it, and the instalments have been piling up since. I want to reopen the shop and repay the loan slowly, so that my two children can stay in school.',
    urgency: 'CRITICAL' as const,
    totalDebt: 18_500_000,
    paid: 3_500_000,
    requested: 15_000_000,
    raised: 10_500_000,
    donors: 42,
    featured: true,
    status: 'PUBLISHED' as const,
  },
  {
    slug: 'demo-mothers-treatment',
    title: "Support my mother's treatment after the surgery",
    beneficiary: '9100000002',
    category: 'medical',
    story:
      'My mother needs a follow-up procedure after her surgery. The hospital has already been paid in part, and the rest of the bill is due before the next appointment. I work as a tailor and cannot cover this alone.',
    urgency: 'HIGH' as const,
    totalDebt: 30_000_000,
    paid: 6_000_000,
    requested: 24_000_000,
    raised: 19_200_000,
    donors: 77,
    featured: true,
    status: 'PUBLISHED' as const,
  },
  {
    slug: 'demo-student-education',
    title: 'Help a student continue her final year of education',
    beneficiary: '9100000003',
    category: 'education',
    story:
      'I am the first person in my family to reach college. My final-year fees are due this term and my family cannot pay them after a year of reduced income. With support I can finish my degree and start working.',
    urgency: 'MEDIUM' as const,
    totalDebt: 7_500_000,
    paid: 0,
    requested: 7_500_000,
    raised: 5_250_000,
    donors: 31,
    featured: false,
    status: 'PUBLISHED' as const,
  },
  {
    slug: 'demo-family-house-fire',
    title: 'Help my family rebuild after a house fire',
    beneficiary: '9100000002',
    category: 'family',
    story:
      'A short circuit caused a fire that destroyed our kitchen and most of our belongings. We are staying with relatives for now. We need help with basic furniture, cooking utensils and the first month of rent for a new place.',
    urgency: 'HIGH' as const,
    totalDebt: 0,
    paid: 0,
    requested: 20_000_000,
    raised: 5_000_000,
    donors: 18,
    featured: false,
    status: 'PUBLISHED' as const,
  },
  {
    slug: 'demo-job-loss-credit-card',
    title: 'Clear credit card debt after a job loss',
    beneficiary: '9100000004',
    category: 'debt-relief',
    story:
      'I lost my job during the layoffs and used my credit card to cover rent and groceries. The minimum payments have become impossible. I am now freelancing and want to clear the balance in a structured way.',
    urgency: 'MEDIUM' as const,
    totalDebt: 18_000_000,
    paid: 0,
    requested: 18_000_000,
    raised: 17_000_000,
    donors: 96,
    featured: false,
    status: 'PUBLISHED' as const,
  },
  {
    slug: 'demo-emergency-rent-food',
    title: 'Emergency rent and food for a family of five',
    beneficiary: '9100000004',
    category: 'emergency',
    story:
      'My father was hospitalised suddenly and we have no income for the last three weeks. Rent is due this week and we are running short on food. We are asking for immediate help to cover the next month.',
    urgency: 'CRITICAL' as const,
    totalDebt: 6_000_000,
    paid: 0,
    requested: 6_000_000,
    raised: 1_200_000,
    donors: 9,
    featured: false,
    status: 'PUBLISHED' as const,
  },
  {
    slug: 'demo-pending-surgery',
    title: "Support my son's heart surgery",
    beneficiary: '9100000003',
    category: 'medical',
    story:
      'My son needs a heart surgery that our local hospital has scheduled for next month. The estimate is higher than our savings, and we are still gathering the final bills from the hospital. This campaign is awaiting verification.',
    urgency: 'HIGH' as const,
    totalDebt: 45_000_000,
    paid: 0,
    requested: 40_000_000,
    raised: 0,
    donors: 0,
    featured: false,
    status: 'UNDER_REVIEW' as const,
  },
];

async function ensureUser(args: { mobile: string; name: string; userType: 'BENEFICIARY' | 'DONOR' | 'BOTH' | 'DONOR' }) {
  const mobileHash = keyedHash(args.mobile, 'mobile');
  return db.user.upsert({
    where: { mobileHash },
    update: { fullName: args.name },
    create: {
      mobileHash,
      mobileEncrypted: encryptText(args.mobile),
      mobileLast4: args.mobile.slice(-4),
      fullName: args.name,
      userType: args.userType,
      status: 'ACTIVE',
      mobileVerifiedAt: new Date(),
      consentAcceptedAt: new Date(),
      profile: { create: { notifyEmail: false } },
    },
  });
}

async function main() {
  console.info('Seeding HelpTrust demo data (development only)…');
  await syncRbac();

  for (const c of CATEGORIES) {
    await db.campaignCategory.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  const categoryBySlug = new Map((await db.campaignCategory.findMany()).map((c) => [c.slug, c.id]));

  for (const s of STAFF) {
    const u = await ensureUser({ mobile: s.mobile, name: s.name, userType: 'DONOR' });
    for (const roleKey of s.roles) {
      const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
      await db.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: role.id } },
        update: {},
        create: { userId: u.id, roleId: role.id, assignedBy: 'seed' },
      });
    }
  }

  const beneficiaryIds = new Map<string, string>();
  for (const b of BENEFICIARIES) {
    const u = await ensureUser({ mobile: b.mobile, name: b.name, userType: 'BENEFICIARY' });
    beneficiaryIds.set(b.mobile, u.id);
    await db.userProfile.update({
      where: { userId: u.id },
      data: { addressLine: b.address, city: b.city, state: b.state, pincode: b.pincode },
    });
    for (const type of ['IDENTITY', 'ADDRESS'] as const) {
      await db.verification.upsert({
        where: { userId_type: { userId: u.id, type } },
        update: { status: 'VERIFIED', verifiedAt: new Date(), providerName: 'mock-sandbox' },
        create: { userId: u.id, type, status: 'VERIFIED', verifiedAt: new Date(), providerName: 'mock-sandbox' },
      });
    }
    const accountNumber = `0000${b.mobile.slice(-6)}1234`;
    const accountHash = keyedHash(accountNumber, 'bank-account');
    await db.bankVerification.upsert({
      where: { id: `seed-bank-${b.mobile}` },
      update: {},
      create: {
        id: `seed-bank-${b.mobile}`,
        userId: u.id,
        accountHolderName: b.name,
        accountNumberEncrypted: encryptText(accountNumber),
        accountHash,
        accountLast4: accountNumber.slice(-4),
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        status: 'VERIFIED',
        isPrimary: true,
        verifiedAt: new Date(),
      },
    });
    await db.verification.upsert({
      where: { userId_type: { userId: u.id, type: 'BANK_ACCOUNT' } },
      update: { status: 'VERIFIED', verifiedAt: new Date(), providerName: 'mock-sandbox' },
      create: { userId: u.id, type: 'BANK_ACCOUNT', status: 'VERIFIED', verifiedAt: new Date(), providerName: 'mock-sandbox' },
    });
  }

  const donorIds: string[] = [];
  for (const d of DONORS) {
    const u = await ensureUser({ mobile: d.mobile, name: d.name, userType: 'DONOR' });
    donorIds.push(u.id);
  }

  for (const c of CAMPAIGNS) {
    const beneficiaryId = beneficiaryIds.get(c.beneficiary)!;
    const categoryId = categoryBySlug.get(c.category)!;
    const remaining = c.totalDebt > 0 ? c.totalDebt - c.paid : c.requested;
    const fundingPercent = Math.min(100, Math.round((c.raised / c.requested) * 100));
    const published = c.status === 'PUBLISHED';
    const campaign = await db.campaign.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        title: c.title,
        story: c.story,
        beneficiaryId,
        categoryId,
        city: BENEFICIARIES.find((b) => b.mobile === c.beneficiary)!.city,
        state: BENEFICIARIES.find((b) => b.mobile === c.beneficiary)!.state,
        status: c.status,
        urgency: c.urgency,
        totalDebtPaise: c.totalDebt,
        paidPaise: c.paid,
        remainingPaise: remaining,
        requestedPaise: c.requested,
        raisedPaise: c.raised,
        fundingPercent,
        donorCount: c.donors,
        featured: c.featured,
        submittedAt: new Date(Date.now() - 5 * 86_400_000),
        approvedAt: published ? new Date(Date.now() - 4 * 86_400_000) : null,
        publishedAt: published ? new Date(Date.now() - 3 * 86_400_000) : null,
        endsAt: new Date(Date.now() + 45 * 86_400_000),
      },
    });

    // Sample confirmed donations so totals and receipts look real in development.
    if (published && c.raised > 0) {
      const donationId = `seed-don-${campaign.id.slice(-8)}`;
      const exists = await db.donation.findUnique({ where: { id: donationId } });
      if (!exists) {
        await db.donation.create({
          data: {
            id: donationId,
            donorId: donorIds[0],
            campaignId: campaign.id,
            amountPaise: c.raised,
            status: 'SUCCESS',
            receiptNumber: `HTSEED-${campaign.id.slice(-6).toUpperCase()}`,
            idempotencyKey: `seed-${campaign.id}`,
            paidAt: new Date(Date.now() - 2 * 86_400_000),
            payment: {
              create: {
                provider: 'MOCK',
                status: 'CAPTURED',
                amountPaise: c.raised,
                method: 'upi',
                providerOrderId: `order_seed_${campaign.id.slice(-8)}`,
                providerPaymentId: `pay_seed_${campaign.id.slice(-8)}`,
              },
            },
          },
        });
      }
    }
  }

  console.info(`Done. ${STAFF.length} staff, ${BENEFICIARIES.length} beneficiaries, ${DONORS.length} donors, ${CAMPAIGNS.length} campaigns.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
