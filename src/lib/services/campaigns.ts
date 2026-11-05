import crypto from 'node:crypto';
import type { Prisma, CampaignStatus, DocKind, Urgency } from '@prisma/client';
import { db } from '../db';
import { keyedHash } from '../crypto';
import { errors } from '../http';
import { daysLeft, percent, publicName, slugify } from '../format';
import {
  EDITABLE_STATUSES,
  MAX_OPEN_CAMPAIGNS_PER_USER,
  OPEN_STATUSES,
  assertTransition,
} from '../state/campaign-machine';
import { audit } from './audit';
import { notify } from './notifications';
import { checkDuplicateCampaign, checkRepeatedCampaigns } from './fraud';
import {
  campaignDetailsSchema,
  campaignFinancialSchema,
  campaignPersonalSchema,
  campaignSearchSchema,
} from '../validation/schemas';
import { PERMISSIONS, type Permission, hasPermission } from '../rbac';
import { getCurrentUser } from '../auth/session';

/** Documents required before a campaign can be submitted. */
export const REQUIRED_DOCS_FOR_SUBMISSION: { kinds: DocKind[]; label: string }[] = [
  { kinds: ['IDENTITY'], label: 'Government ID' },
  { kinds: ['ADDRESS'], label: 'Address proof' },
  { kinds: ['LOAN_STATEMENT', 'MEDICAL_BILL', 'EDUCATION_FEE', 'OTHER'], label: 'Bill or loan statement' },
];

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  city: true,
  state: true,
  requestedPaise: true,
  raisedPaise: true,
  fundingPercent: true,
  donorCount: true,
  urgency: true,
  endsAt: true,
  featured: true,
  coverImageUrl: true,
  publishedAt: true,
  createdAt: true,
  category: { select: { slug: true, name: true, tone: true } },
  beneficiary: { select: { fullName: true } },
  documents: {
    where: { kind: 'PHOTO', reviewStatus: 'APPROVED' },
    select: { id: true },
    take: 1,
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.CampaignSelect;

type CardRow = Prisma.CampaignGetPayload<{ select: typeof cardSelect }>;

/** The only shape that ever leaves the server for public campaign cards. No IDs of people, no documents. */
export function toCard(c: CardRow) {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    city: c.city,
    state: c.state,
    category: c.category,
    beneficiaryName: publicName(c.beneficiary.fullName),
    requestedPaise: c.requestedPaise,
    raisedPaise: c.raisedPaise,
    fundingPercent: c.fundingPercent,
    donorCount: c.donorCount,
    urgency: c.urgency,
    daysLeft: daysLeft(c.endsAt),
    featured: c.featured,
    verified: true as const,
    imageUrl: c.coverImageUrl ?? (c.documents[0] ? `/api/media/${c.documents[0].id}` : null),
    publishedAt: c.publishedAt,
    createdAt: c.createdAt,
  };
}

export type CampaignCard = ReturnType<typeof toCard>;

/* ---------- Public catalogue ---------- */

export async function searchCampaigns(raw: Record<string, string | undefined>) {
  const q = campaignSearchSchema.parse(raw);
  const where: Prisma.CampaignWhereInput = { status: 'PUBLISHED' };

  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: 'insensitive' } },
      { city: { contains: q.q, mode: 'insensitive' } },
      { category: { name: { contains: q.q, mode: 'insensitive' } } },
      { beneficiary: { fullName: { contains: q.q, mode: 'insensitive' } } },
    ];
  }
  if (q.category) where.category = { slug: q.category };
  if (q.city) where.city = { contains: q.city, mode: 'insensitive' };
  if (q.funding === 'open') where.fundingPercent = { lt: 75 };
  if (q.funding === 'nearly') where.fundingPercent = { gte: 75, lt: 100 };
  if (q.funding === 'funded') where.fundingPercent = { gte: 100 };

  const orderBy: Prisma.CampaignOrderByWithRelationInput[] =
    q.sort === 'urgent'
      ? [{ urgency: 'desc' }, { endsAt: 'asc' }]
      : q.sort === 'supported'
        ? [{ donorCount: 'desc' }, { raisedPaise: 'desc' }]
        : q.sort === 'nearly'
          ? [{ fundingPercent: 'desc' }, { endsAt: 'asc' }]
          : [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

  const [total, rows] = await Promise.all([
    db.campaign.count({ where }),
    db.campaign.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: cardSelect,
    }),
  ]);
  return { items: rows.map(toCard), total, page: q.page, pageSize: q.pageSize, hasMore: q.page * q.pageSize < total };
}

export async function homeSections() {
  const base: Prisma.CampaignWhereInput = { status: 'PUBLISHED' };
  const [featured, urgent, recent, verified, categories, stats] = await Promise.all([
    db.campaign.findMany({ where: { ...base, featured: true }, orderBy: { publishedAt: 'desc' }, take: 6, select: cardSelect }),
    db.campaign.findMany({ where: base, orderBy: [{ urgency: 'desc' }, { endsAt: 'asc' }], take: 6, select: cardSelect }),
    db.campaign.findMany({ where: base, orderBy: { publishedAt: 'desc' }, take: 6, select: cardSelect }),
    db.campaign.findMany({ where: { ...base, fundingPercent: { lt: 100 } }, orderBy: { fundingPercent: 'desc' }, take: 6, select: cardSelect }),
    db.campaignCategory.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    platformTotals(),
  ]);
  return {
    featured: featured.map(toCard),
    urgent: urgent.map(toCard),
    recent: recent.map(toCard),
    verified: verified.map(toCard),
    categories,
    stats,
  };
}

/** Live platform totals. Shown as they are, never inflated. */
export async function platformTotals() {
  const [helped, raised, verifiedCampaigns, donors] = await Promise.all([
    db.campaign.count({ where: { status: 'PUBLISHED', raisedPaise: { gt: 0 } } }),
    db.donation.aggregate({ where: { status: 'SUCCESS' }, _sum: { amountPaise: true } }),
    db.campaign.count({ where: { status: { in: ['APPROVED', 'PUBLISHED', 'CLOSED'] } } }),
    db.donation.findMany({ where: { status: 'SUCCESS' }, distinct: ['donorId'], select: { donorId: true } }),
  ]);
  return {
    campaignsFunded: helped,
    totalRaisedPaise: raised._sum.amountPaise ?? 0,
    verifiedCampaigns,
    donors: donors.length,
  };
}

export async function getPublicCampaign(slug: string, viewerId?: string | null) {
  const c = await db.campaign.findUnique({
    where: { slug },
    select: {
      ...cardSelect,
      story: true,
      status: true,
      totalDebtPaise: true,
      paidPaise: true,
      remainingPaise: true,
      reviewNote: true,
      updates: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, body: true, createdAt: true } },
      donations: {
        where: { status: 'SUCCESS' },
        orderBy: { paidAt: 'desc' },
        take: 8,
        select: { amountPaise: true, isAnonymous: true, paidAt: true, donor: { select: { fullName: true } } },
      },
    },
  });
  if (!c || (c.status !== 'PUBLISHED' && c.status !== 'CLOSED')) return null;
  // Only the kinds are exposed publicly (for the checklist), never the files or their IDs.
  const approvedDocs = await db.campaignDocument.findMany({
    where: { campaignId: c.id, reviewStatus: 'APPROVED' },
    select: { kind: true },
  });

  const verifiedChecklist = [
    { key: 'MOBILE', label: 'Mobile number verified' },
    { key: 'IDENTITY', label: 'Identity verified' },
    { key: 'ADDRESS', label: 'Address verified' },
    { key: 'BANK', label: 'Bank account verified' },
    { key: 'DOCUMENTS', label: 'Supporting documents reviewed' },
  ];
  const saved = viewerId
    ? !!(await db.savedCampaign.findUnique({ where: { userId_campaignId: { userId: viewerId, campaignId: c.id } } }))
    : false;

  return {
    ...toCard(c),
    story: c.story,
    status: c.status,
    totalDebtPaise: c.totalDebtPaise,
    paidPaise: c.paidPaise,
    remainingPaise: c.remainingPaise,
    endsAt: c.endsAt,
    checklist: verifiedChecklist,
    updates: c.updates,
    recentDonations: c.donations.map((d) => ({
      amountPaise: d.amountPaise,
      donorName: d.isAnonymous ? 'Anonymous donor' : publicName(d.donor.fullName),
      paidAt: d.paidAt,
    })),
    documentKinds: Array.from(new Set(approvedDocs.map((d) => d.kind))),
    saved,
  };
}

/* ---------- Beneficiary: create and edit ---------- */

async function assertOwner(userId: string, campaignId: string) {
  const c = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!c || c.beneficiaryId !== userId) throw errors.notFound('Campaign');
  return c;
}

export async function createDraft(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { status: true, userType: true } });
  if (!user || user.status !== 'ACTIVE') throw errors.forbidden('Your account must be active to create a campaign.');

  const open = await db.campaign.count({ where: { beneficiaryId: userId, status: { in: OPEN_STATUSES } } });
  if (open >= MAX_OPEN_CAMPAIGNS_PER_USER) {
    throw errors.invalidState(`You can have up to ${MAX_OPEN_CAMPAIGNS_PER_USER} open campaigns at a time.`);
  }
  const category = await db.campaignCategory.findFirst({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  if (!category) throw errors.invalidState('Campaign categories are not configured yet.');

  const campaign = await db.$transaction(async (tx) => {
    if (user.userType === 'DONOR') await tx.user.update({ where: { id: userId }, data: { userType: 'BOTH' } });
    return tx.campaign.create({
      data: {
        slug: `draft-${crypto.randomBytes(5).toString('hex')}`,
        title: 'Untitled campaign',
        story: '',
        beneficiaryId: userId,
        categoryId: category.id,
        city: '',
        state: '',
        status: 'DRAFT',
        endsAt: new Date(Date.now() + 60 * 86_400_000),
      },
      select: { id: true },
    });
  });
  return campaign;
}

/** Owner view used by the wizard and status screens. Storage keys are never returned. */
export async function getOwnedCampaign(userId: string, campaignId: string) {
  const c = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      category: true,
      beneficiary: { select: { fullName: true, mobileLast4: true, profile: true } },
      documents: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, kind: true, mimeType: true, sizeBytes: true, reviewStatus: true, reviewNote: true, createdAt: true },
      },
      updates: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, body: true, createdAt: true } },
    },
  });
  if (!c || c.beneficiaryId !== userId) throw errors.notFound('Campaign');
  return c;
}

export async function savePersonalStep(userId: string, campaignId: string, body: unknown) {
  const data = campaignPersonalSchema.parse(body);
  const c = await assertOwner(userId, campaignId);
  if (!EDITABLE_STATUSES.includes(c.status)) throw errors.invalidState('This campaign can no longer be edited.');

  const user = await db.user.findUnique({ where: { id: userId }, select: { mobileHash: true } });
  // The campaign contact number must be the one the beneficiary verified at sign-in.
  if (!user || keyedHash(data.mobile, 'mobile') !== user.mobileHash) {
    throw errors.badRequest('Use the mobile number you verified with to sign in.');
  }

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { fullName: data.fullName } }),
    db.userProfile.upsert({
      where: { userId },
      update: { addressLine: data.addressLine, city: data.city, state: data.state, pincode: data.pincode },
      create: { userId, addressLine: data.addressLine, city: data.city, state: data.state, pincode: data.pincode },
    }),
    db.campaign.update({ where: { id: campaignId }, data: { city: data.city, state: data.state } }),
  ]);
  return { saved: true };
}

export async function saveDetailsStep(userId: string, campaignId: string, body: unknown) {
  const data = campaignDetailsSchema.parse(body);
  const c = await assertOwner(userId, campaignId);
  if (!EDITABLE_STATUSES.includes(c.status)) throw errors.invalidState('This campaign can no longer be edited.');
  const category = await db.campaignCategory.findFirst({ where: { slug: data.categorySlug, active: true } });
  if (!category) throw errors.badRequest('Choose a valid category.');

  const slug = `${slugify(data.title) || 'campaign'}-${c.id.slice(-6)}`;
  await db.campaign.update({
    where: { id: campaignId },
    data: {
      title: data.title,
      slug,
      story: data.story,
      categoryId: category.id,
      urgency: data.urgency as Urgency,
      endsAt: new Date(Date.now() + data.endsInDays * 86_400_000),
    },
  });
  return { saved: true, slug };
}

export async function saveFinancialStep(userId: string, campaignId: string, body: unknown) {
  const data = campaignFinancialSchema.parse(body);
  const c = await assertOwner(userId, campaignId);
  if (!EDITABLE_STATUSES.includes(c.status)) throw errors.invalidState('This campaign can no longer be edited.');
  await db.campaign.update({
    where: { id: campaignId },
    data: {
      totalDebtPaise: data.totalDebtPaise,
      paidPaise: data.paidPaise,
      remainingPaise: data.totalDebtPaise - data.paidPaise,
      requestedPaise: data.requestedPaise,
    },
  });
  return { saved: true, remainingPaise: data.totalDebtPaise - data.paidPaise };
}

/** Checklist shown on the review screen and enforced on submit. */
export async function submissionChecklist(userId: string, campaignId: string) {
  const c = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      documents: { select: { kind: true, reviewStatus: true } },
    },
  });
  if (!c || c.beneficiaryId !== userId) throw errors.notFound('Campaign');
  const [user, verifications, bank] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { fullName: true, profile: { select: { addressLine: true, city: true, pincode: true } } },
    }),
    db.verification.findMany({ where: { userId }, select: { type: true, status: true } }),
    db.bankVerification.findFirst({ where: { userId, isPrimary: true }, select: { status: true } }),
  ]);
  const vStatus = (t: string) => verifications.find((v) => v.type === t)?.status ?? null;

  const items = [
    { key: 'personal', label: 'Personal information', ok: !!user?.fullName && !!user.profile?.addressLine && !!c.city },
    { key: 'campaign', label: 'Campaign details', ok: c.title.length >= 10 && c.story.length >= 100 && c.categoryId !== '' && c.title !== 'Untitled campaign' },
    { key: 'financial', label: 'Financial details', ok: c.totalDebtPaise > 0 && c.requestedPaise >= 10_000 && c.requestedPaise <= c.remainingPaise },
    ...REQUIRED_DOCS_FOR_SUBMISSION.map((req) => ({
      key: `doc:${req.label}`,
      label: req.label,
      ok: c.documents.some((d) => req.kinds.includes(d.kind) && d.reviewStatus !== 'REJECTED'),
    })),
    { key: 'identity', label: 'Identity verification', ok: vStatus('IDENTITY') !== null && vStatus('IDENTITY') !== 'REJECTED' },
    { key: 'address', label: 'Address verification', ok: vStatus('ADDRESS') !== null && vStatus('ADDRESS') !== 'REJECTED' },
    { key: 'bank', label: 'Bank account verification', ok: !!bank && bank.status !== 'REJECTED' },
  ];
  return { items, complete: items.every((i) => i.ok) };
}

export async function submitCampaign(userId: string, campaignId: string) {
  const c = await assertOwner(userId, campaignId);
  const checklist = await submissionChecklist(userId, campaignId);
  if (!checklist.complete) {
    const missing = checklist.items.filter((i) => !i.ok).map((i) => i.label);
    throw errors.invalidState(`Complete these before submitting: ${missing.join(', ')}.`);
  }
  assertTransition(c.status, 'PENDING');

  const updated = await db.campaign.updateMany({
    where: { id: campaignId, status: c.status },
    data: { status: 'PENDING', submittedAt: new Date(), reviewNote: null },
  });
  if (updated.count === 0) throw errors.conflict('This campaign was changed. Refresh and try again.');

  await notify({
    userId,
    type: 'CAMPAIGN_STATUS',
    title: 'Campaign submitted',
    body: 'Thanks. Our verification team will review your campaign. We will update you here.',
    link: `/app/status/${campaignId}`,
    sms: 'CAMPAIGN_STATUS',
  });
  await audit({ actorId: userId, action: 'campaign.submitted', entityType: 'Campaign', entityId: campaignId });

  // Duplicate and abuse checks run after submission. They raise review flags and never block the beneficiary.
  const fresh = await db.campaign.findUnique({ where: { id: campaignId }, select: { id: true, title: true, city: true, beneficiaryId: true } });
  if (fresh) {
    await checkDuplicateCampaign(fresh).catch(() => undefined);
    await checkRepeatedCampaigns(userId).catch(() => undefined);
  }
  return { status: 'PENDING' as const };
}

/** Beneficiary moves a rejected campaign back to draft so it can be corrected and resubmitted. */
export async function reopenRejected(userId: string, campaignId: string) {
  const c = await assertOwner(userId, campaignId);
  assertTransition(c.status, 'DRAFT');
  await db.campaign.update({ where: { id: campaignId }, data: { status: 'DRAFT' } });
  return { status: 'DRAFT' as const };
}

export async function postUpdate(userId: string, campaignId: string, body: string) {
  const c = await assertOwner(userId, campaignId);
  if (c.status !== 'PUBLISHED') throw errors.invalidState('Updates can be posted once the campaign is live.');
  const row = await db.campaignUpdate.create({ data: { campaignId, authorId: userId, body }, select: { id: true, body: true, createdAt: true } });
  const donors = await db.donation.findMany({ where: { campaignId, status: 'SUCCESS' }, distinct: ['donorId'], select: { donorId: true }, take: 500 });
  await Promise.all(
    donors.map((d) =>
      notify({ userId: d.donorId, type: 'CAMPAIGN_STATUS', title: 'New update on a campaign you support', body: body.slice(0, 140), link: `/app/campaign/${c.slug}` }),
    ),
  );
  return row;
}

export async function setSaved(userId: string, campaignId: string, saved: boolean) {
  const c = await db.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (!c || !['PUBLISHED', 'CLOSED'].includes(c.status)) throw errors.notFound('Campaign');
  if (saved) {
    await db.savedCampaign.upsert({
      where: { userId_campaignId: { userId, campaignId } },
      update: {},
      create: { userId, campaignId },
    });
  } else {
    await db.savedCampaign.deleteMany({ where: { userId, campaignId } });
  }
  return { saved };
}

export async function listSaved(userId: string) {
  const rows = await db.savedCampaign.findMany({
    where: { userId, campaign: { status: { in: ['PUBLISHED', 'CLOSED'] } } },
    orderBy: { createdAt: 'desc' },
    select: { campaign: { select: cardSelect } },
  });
  return rows.map((r) => toCard(r.campaign));
}

export async function listMyCampaigns(userId: string) {
  return db.campaign.findMany({
    where: { beneficiaryId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      requestedPaise: true,
      raisedPaise: true,
      fundingPercent: true,
      donorCount: true,
      remainingPaise: true,
      updatedAt: true,
      submittedAt: true,
      reviewNote: true,
      rejectionReason: true,
      category: { select: { name: true } },
    },
  });
}

/* ---------- Admin review ---------- */

export type ReviewAction = 'START_REVIEW' | 'REQUEST_INFO' | 'APPROVE' | 'REJECT' | 'PUBLISH' | 'CLOSE';

const ACTION_PERMISSION: Record<ReviewAction, Permission> = {
  START_REVIEW: PERMISSIONS.CAMPAIGN_REVIEW,
  REQUEST_INFO: PERMISSIONS.CAMPAIGN_REVIEW,
  APPROVE: PERMISSIONS.CAMPAIGN_REVIEW,
  REJECT: PERMISSIONS.CAMPAIGN_REVIEW,
  PUBLISH: PERMISSIONS.CAMPAIGN_PUBLISH,
  CLOSE: PERMISSIONS.CAMPAIGN_REVIEW,
};

const ACTION_TARGET: Record<ReviewAction, CampaignStatus> = {
  START_REVIEW: 'UNDER_REVIEW',
  REQUEST_INFO: 'ADDITIONAL_INFO_REQUIRED',
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  PUBLISH: 'PUBLISHED',
  CLOSE: 'CLOSED',
};

/**
 * Approval gate. A campaign is approved only when every verification is VERIFIED and every
 * uploaded document has been reviewed and approved. Nothing is published without this check.
 */
export async function approvalBlockers(campaignId: string): Promise<string[]> {
  const c = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { beneficiaryId: true, documents: { select: { kind: true, reviewStatus: true } } },
  });
  if (!c) return ['Campaign not found'];
  const blockers: string[] = [];
  const verifications = await db.verification.findMany({ where: { userId: c.beneficiaryId }, select: { type: true, status: true } });
  const bank = await db.bankVerification.findFirst({ where: { userId: c.beneficiaryId, isPrimary: true }, select: { status: true } });
  for (const t of ['IDENTITY', 'ADDRESS'] as const) {
    const v = verifications.find((x) => x.type === t);
    if (!v || v.status !== 'VERIFIED') blockers.push(`${t.toLowerCase()} verification is not complete`);
  }
  if (!bank || bank.status !== 'VERIFIED') blockers.push('bank account verification is not complete');
  for (const d of c.documents) {
    if (d.reviewStatus !== 'APPROVED') blockers.push(`a ${d.kind.toLowerCase().replace('_', ' ')} document is not approved`);
  }
  if (!c.documents.some((d) => ['LOAN_STATEMENT', 'MEDICAL_BILL', 'EDUCATION_FEE', 'OTHER'].includes(d.kind))) {
    blockers.push('no bill or loan statement uploaded');
  }
  return Array.from(new Set(blockers));
}

export async function reviewCampaign(args: {
  actorId: string;
  campaignId: string;
  action: ReviewAction;
  note?: string;
  ip?: string | null;
}) {
  if (!(await hasPermission(args.actorId, ACTION_PERMISSION[args.action]))) throw errors.forbidden();

  const c = await db.campaign.findUnique({ where: { id: args.campaignId }, select: { id: true, status: true, beneficiaryId: true, slug: true, title: true } });
  if (!c) throw errors.notFound('Campaign');

  const target = ACTION_TARGET[args.action];
  assertTransition(c.status, target);

  if ((args.action === 'REQUEST_INFO' || args.action === 'REJECT') && !args.note) {
    throw errors.badRequest('Add a note explaining what the beneficiary needs to fix.');
  }
  if (args.action === 'APPROVE') {
    const blockers = await approvalBlockers(c.id);
    if (blockers.length) throw errors.invalidState(`Cannot approve yet: ${blockers.join('; ')}.`);
  }

  const data: Prisma.CampaignUpdateManyMutationInput = { status: target };
  if (args.action === 'APPROVE') data.approvedAt = new Date();
  if (args.action === 'PUBLISH') data.publishedAt = new Date();
  if (args.action === 'REQUEST_INFO') data.reviewNote = args.note ?? null;
  if (args.action === 'REJECT') data.rejectionReason = args.note ?? null;

  const updated = await db.campaign.updateMany({ where: { id: c.id, status: c.status }, data });
  if (updated.count === 0) throw errors.conflict('This campaign was updated by another reviewer. Refresh and try again.');

  const messages: Partial<Record<ReviewAction, { title: string; body: string }>> = {
    START_REVIEW: { title: 'Campaign under review', body: 'A verification officer has started reviewing your campaign.' },
    REQUEST_INFO: { title: 'More information needed', body: args.note ?? 'Please update your campaign so we can continue.' },
    APPROVE: { title: 'Campaign approved', body: 'Your campaign passed verification and is ready to go live.' },
    REJECT: { title: 'Campaign not approved', body: args.note ?? 'Your campaign was not approved. See the details in your campaign status.' },
    PUBLISH: { title: 'Your campaign is live', body: 'Donors can now see and support your campaign.' },
    CLOSE: { title: 'Campaign closed', body: 'Your campaign is closed for new donations.' },
  };
  const m = messages[args.action];
  if (m) {
    await notify({ userId: c.beneficiaryId, type: 'CAMPAIGN_STATUS', title: m.title, body: m.body, link: `/app/status/${c.id}`, sms: 'CAMPAIGN_STATUS' });
  }
  await audit({
    actorId: args.actorId,
    action: `campaign.${args.action.toLowerCase()}`,
    entityType: 'Campaign',
    entityId: c.id,
    metadata: { from: c.status, to: target, hasNote: !!args.note },
    ip: args.ip,
  });
  return { status: target };
}

/* ---------- Helpers used by other services ---------- */

export function campaignCardPath(slug: string) {
  return `/app/campaign/${slug}`;
}

export function fundingFor(raisedPaise: number, requestedPaise: number) {
  return percent(raisedPaise, requestedPaise);
}

/** Current viewer for optional-auth public pages. */
export async function optionalViewerId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}
