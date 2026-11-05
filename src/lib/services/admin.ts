import type { ComplaintStatus, FraudStatus, Prisma, UserStatus, UserType } from '@prisma/client';
import { db } from '../db';
import { errors } from '../http';
import { formatINR } from '../format';
import { hasPermission, PERMISSIONS, ROLE_DEFINITIONS } from '../rbac';
import { csvSafe } from './text';
import { audit } from './audit';
import { notify } from './notifications';
import { invalidateUserSessions } from './profile';

/* ---------- Dashboard ---------- */

export async function adminOverview() {
  const [users, campaigns, verified, pending, donations, successful, failed, refunds, openFraud, openComplaints] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.campaign.count(),
    db.campaign.count({ where: { status: { in: ['APPROVED', 'PUBLISHED', 'CLOSED'] } } }),
    db.campaign.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED'] } } }),
    db.donation.aggregate({ where: { status: 'SUCCESS' }, _sum: { amountPaise: true }, _count: true }),
    db.payment.count({ where: { status: 'CAPTURED' } }),
    db.payment.count({ where: { status: 'FAILED' } }),
    db.refund.aggregate({ where: { status: 'PROCESSED' }, _sum: { amountPaise: true }, _count: true }),
    db.fraudReport.count({ where: { status: { in: ['OPEN', 'UNDER_INVESTIGATION'] } } }),
    db.complaint.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);
  return {
    totalUsers: users,
    totalCampaigns: campaigns,
    verifiedCampaigns: verified,
    pendingApplications: pending,
    totalDonationsPaise: donations._sum.amountPaise ?? 0,
    totalDonationCount: donations._count,
    successfulPayments: successful,
    failedPayments: failed,
    refundsPaise: refunds._sum.amountPaise ?? 0,
    refundCount: refunds._count,
    openFraudReports: openFraud,
    openComplaints,
    display: {
      totalDonations: formatINR(donations._sum.amountPaise ?? 0),
      refunds: formatINR(refunds._sum.amountPaise ?? 0),
    },
  };
}

/* ---------- Queues ---------- */

export async function campaignQueue(status?: string, q?: string, page = 1) {
  const where: Prisma.CampaignWhereInput = {};
  if (status && status !== 'ALL') where.status = status as Prisma.CampaignWhereInput['status'];
  else where.status = { notIn: ['DRAFT'] };
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }];
  const [total, rows] = await Promise.all([
    db.campaign.count({ where }),
    db.campaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        urgency: true,
        city: true,
        requestedPaise: true,
        raisedPaise: true,
        fundingPercent: true,
        submittedAt: true,
        updatedAt: true,
        category: { select: { name: true } },
        beneficiary: { select: { fullName: true, mobileLast4: true } },
        _count: { select: { documents: true, fraudReports: true } },
      },
    }),
  ]);
  return { total, page, items: rows };
}

export async function campaignDetailForAdmin(id: string) {
  const c = await db.campaign.findUnique({
    where: { id },
    include: {
      category: true,
      beneficiary: { select: { id: true, fullName: true, mobileLast4: true, status: true, userType: true, createdAt: true, profile: { select: { city: true, state: true, pincode: true, addressLine: true } } } },
      documents: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, kind: true, mimeType: true, sizeBytes: true, reviewStatus: true, reviewNote: true, sha256: true, createdAt: true },
      },
      fraudReports: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, ruleCode: true, reason: true, severity: true, status: true, createdAt: true } },
      donations: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'desc' }, take: 10, select: { id: true, amountPaise: true, paidAt: true, isAnonymous: true, receiptNumber: true } },
    },
  });
  if (!c) return null;
  const verifications = await db.verification.findMany({ where: { userId: c.beneficiaryId }, select: { id: true, type: true, status: true, providerName: true, verifiedAt: true } });
  const bank = await db.bankVerification.findFirst({ where: { userId: c.beneficiaryId, isPrimary: true }, select: { id: true, accountHolderName: true, accountLast4: true, ifscCode: true, status: true } });
  return { ...c, verifications, bank };
}

export async function documentQueueSummary() {
  return db.campaignDocument.groupBy({ by: ['reviewStatus'], _count: true });
}

export async function listUsers(args: { q?: string; status?: string; page?: number; userTypes?: UserType[] }) {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (args.userTypes) where.userType = { in: args.userTypes };
  if (args.status && args.status !== 'ALL') where.status = args.status as UserStatus;
  if (args.q) {
    where.OR = [{ fullName: { contains: args.q, mode: 'insensitive' } }, { mobileLast4: args.q.slice(-4) }];
  }
  const page = args.page ?? 1;
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 25,
      take: 25,
      select: { id: true, fullName: true, mobileLast4: true, userType: true, status: true, createdAt: true, lastLoginAt: true, _count: { select: { campaigns: true, donations: true } } },
    }),
  ]);
  return { total, page, items: rows };
}

export async function listDonationsAdmin(page = 1) {
  return db.donation.findMany({
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * 25,
    take: 25,
    select: {
      id: true,
      amountPaise: true,
      status: true,
      receiptNumber: true,
      isAnonymous: true,
      createdAt: true,
      paidAt: true,
      campaign: { select: { title: true, slug: true } },
      donor: { select: { mobileLast4: true, fullName: true } },
      payment: { select: { status: true, method: true, providerOrderId: true, errorCode: true } },
    },
  });
}

export async function listPaymentsAdmin(status?: string, page = 1) {
  const where: Prisma.PaymentWhereInput = status && status !== 'ALL' ? { status: status as Prisma.PaymentWhereInput['status'] } : {};
  return db.payment.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * 25,
    take: 25,
    select: { id: true, status: true, amountPaise: true, provider: true, method: true, providerOrderId: true, providerPaymentId: true, errorCode: true, updatedAt: true, donation: { select: { id: true, campaign: { select: { title: true } } } } },
  });
}

export async function listRefundsAdmin(status?: string) {
  const where: Prisma.RefundWhereInput = status && status !== 'ALL' ? { status: status as Prisma.RefundWhereInput['status'] } : {};
  return db.refund.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, amountPaise: true, status: true, reason: true, createdAt: true, decidedAt: true, decisionNote: true, donation: { select: { id: true, campaign: { select: { title: true } } } }, requester: { select: { mobileLast4: true, fullName: true } } },
  });
}

export async function listFraud(status?: string) {
  const where: Prisma.FraudReportWhereInput = status && status !== 'ALL' ? { status: status as FraudStatus } : {};
  return db.fraudReport.findMany({
    where,
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: { id: true, ruleCode: true, source: true, reason: true, severity: true, status: true, evidence: true, createdAt: true, campaign: { select: { id: true, title: true, slug: true } }, userId: true },
  });
}

export async function listComplaints(status?: string) {
  const where: Prisma.ComplaintWhereInput = status && status !== 'ALL' ? { status: status as ComplaintStatus } : {};
  return db.complaint.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, subject: true, body: true, status: true, response: true, createdAt: true, resolvedAt: true, user: { select: { fullName: true, mobileLast4: true } }, campaign: { select: { title: true } } },
  });
}

export async function listAudit(args: { entityType?: string; actorId?: string; page?: number }) {
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (args.entityType) where.entityType = args.entityType;
  if (args.actorId) where.actorId = args.actorId;
  return db.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: ((args.page ?? 1) - 1) * 50, take: 50 });
}

export async function listStaff() {
  const rows = await db.user.findMany({
    where: { roles: { some: {} }, deletedAt: null },
    select: { id: true, fullName: true, mobileLast4: true, status: true, roles: { select: { role: { select: { key: true, name: true } } } } },
  });
  return { staff: rows, roles: Object.entries(ROLE_DEFINITIONS).map(([key, v]) => ({ key, name: v.name, description: v.description })) };
}

/* ---------- Actions ---------- */

export async function setUserSuspended(args: { actorId: string; userId: string; suspended: boolean; reason: string; ip?: string | null }) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.USER_SUSPEND))) throw errors.forbidden();
  if (args.actorId === args.userId) throw errors.badRequest('You cannot suspend your own account.');
  const target = await db.user.findUnique({ where: { id: args.userId }, select: { id: true, status: true, deletedAt: true } });
  if (!target || target.deletedAt) throw errors.notFound('User');
  if (args.suspended && target.status === 'SUSPENDED') throw errors.invalidState('This account is already suspended.');
  if (!args.suspended && target.status !== 'SUSPENDED') throw errors.invalidState('This account is not suspended.');

  await db.user.update({
    where: { id: args.userId },
    data: {
      status: args.suspended ? 'SUSPENDED' : 'ACTIVE',
      ...(args.suspended ? { sessionVersion: { increment: 1 } } : {}),
    },
  });
  await audit({ actorId: args.actorId, action: args.suspended ? 'user.suspended' : 'user.reinstated', entityType: 'User', entityId: args.userId, metadata: { reason: args.reason }, ip: args.ip });
  return { status: args.suspended ? 'SUSPENDED' : 'ACTIVE' };
}

export async function updateComplaint(args: { actorId: string; complaintId: string; status: ComplaintStatus; response?: string; ip?: string | null }) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.COMPLAINT_MANAGE))) throw errors.forbidden();
  const c = await db.complaint.findUnique({ where: { id: args.complaintId }, select: { id: true, userId: true } });
  if (!c) throw errors.notFound('Complaint');
  await db.complaint.update({
    where: { id: c.id },
    data: {
      status: args.status,
      assigneeId: args.actorId,
      response: args.response ?? undefined,
      resolvedAt: args.status === 'RESOLVED' || args.status === 'CLOSED' ? new Date() : null,
    },
  });
  await notify({ userId: c.userId, type: 'COMPLAINT_UPDATE', title: 'Complaint update', body: args.response ?? `Your complaint is now ${args.status.toLowerCase().replace('_', ' ')}.`, link: '/app/help' });
  await audit({ actorId: args.actorId, action: 'complaint.updated', entityType: 'Complaint', entityId: c.id, metadata: { status: args.status }, ip: args.ip });
  return { status: args.status };
}

/** Confirming a fraud report never suspends anyone. Suspension is a separate, audited decision. */
export async function updateFraudReport(args: { actorId: string; reportId: string; status: FraudStatus; resolution?: string; ip?: string | null }) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.FRAUD_MANAGE))) throw errors.forbidden();
  if ((args.status === 'CONFIRMED' || args.status === 'DISMISSED') && !args.resolution) {
    throw errors.badRequest('Record the reasoning for this decision.');
  }
  const r = await db.fraudReport.findUnique({ where: { id: args.reportId }, select: { id: true } });
  if (!r) throw errors.notFound('Fraud report');
  await db.fraudReport.update({
    where: { id: r.id },
    data: { status: args.status, resolution: args.resolution ?? undefined, assigneeId: args.actorId, resolvedAt: args.status === 'DISMISSED' || args.status === 'CONFIRMED' ? new Date() : null },
  });
  await audit({ actorId: args.actorId, action: 'fraud.updated', entityType: 'FraudReport', entityId: r.id, metadata: { status: args.status }, ip: args.ip });
  return { status: args.status };
}

export async function assignRole(args: { actorId: string; userId: string; roleKey: string; remove?: boolean; ip?: string | null }) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.STAFF_MANAGE))) throw errors.forbidden();
  if (args.userId === args.actorId) throw errors.badRequest('You cannot change your own staff role.');
  const role = await db.role.findUnique({ where: { key: args.roleKey } });
  if (!role) throw errors.notFound('Role');
  if (args.remove) {
    await db.userRole.deleteMany({ where: { userId: args.userId, roleId: role.id } });
  } else {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: args.userId, roleId: role.id } },
      update: {},
      create: { userId: args.userId, roleId: role.id, assignedBy: args.actorId },
    });
  }
  await invalidateUserSessions(args.userId);
  await audit({ actorId: args.actorId, action: args.remove ? 'staff.role_removed' : 'staff.role_assigned', entityType: 'User', entityId: args.userId, metadata: { role: args.roleKey }, ip: args.ip });
  return { ok: true };
}

export async function setPlatformSetting(args: { actorId: string; key: string; value: unknown }) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.SETTINGS_MANAGE))) throw errors.forbidden();
  await db.platformSetting.upsert({
    where: { key: args.key },
    update: { value: args.value as Prisma.InputJsonValue, updatedBy: args.actorId },
    create: { key: args.key, value: args.value as Prisma.InputJsonValue, updatedBy: args.actorId },
  });
  await audit({ actorId: args.actorId, action: 'settings.updated', entityType: 'PlatformSetting', entityId: args.key, metadata: { value: args.value as string } });
  return { ok: true };
}

export async function getPlatformSettings() {
  const rows = await db.platformSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/* ---------- Exports (CSV, personal data minimised) ---------- */

export async function exportCsv(args: { actorId: string; type: 'donations' | 'campaigns' | 'payments' | 'refunds' | 'audit'; ip?: string | null }) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.REPORT_EXPORT))) throw errors.forbidden();
  let header: string[] = [];
  let rows: unknown[][] = [];
  switch (args.type) {
    case 'donations': {
      const d = await db.donation.findMany({ orderBy: { createdAt: 'desc' }, take: 10000, select: { id: true, amountPaise: true, status: true, receiptNumber: true, isAnonymous: true, paidAt: true, campaign: { select: { slug: true } } } });
      header = ['donation_id', 'campaign_slug', 'amount_inr', 'status', 'receipt_number', 'anonymous', 'paid_at'];
      rows = d.map((x) => [x.id, x.campaign.slug, (x.amountPaise / 100).toFixed(2), x.status, x.receiptNumber, x.isAnonymous, x.paidAt?.toISOString() ?? '']);
      break;
    }
    case 'campaigns': {
      const c = await db.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 10000, select: { id: true, slug: true, status: true, city: true, requestedPaise: true, raisedPaise: true, fundingPercent: true, donorCount: true, createdAt: true } });
      header = ['campaign_id', 'slug', 'status', 'city', 'requested_inr', 'raised_inr', 'funding_percent', 'donors', 'created_at'];
      rows = c.map((x) => [x.id, x.slug, x.status, x.city, (x.requestedPaise / 100).toFixed(2), (x.raisedPaise / 100).toFixed(2), x.fundingPercent, x.donorCount, x.createdAt.toISOString()]);
      break;
    }
    case 'payments': {
      const p = await db.payment.findMany({ orderBy: { updatedAt: 'desc' }, take: 10000, select: { id: true, provider: true, status: true, amountPaise: true, method: true, providerOrderId: true, providerPaymentId: true, errorCode: true, updatedAt: true } });
      header = ['payment_id', 'provider', 'status', 'amount_inr', 'method', 'order_id', 'payment_id_provider', 'error_code', 'updated_at'];
      rows = p.map((x) => [x.id, x.provider, x.status, (x.amountPaise / 100).toFixed(2), x.method, x.providerOrderId, x.providerPaymentId, x.errorCode, x.updatedAt.toISOString()]);
      break;
    }
    case 'refunds': {
      const r = await db.refund.findMany({ orderBy: { createdAt: 'desc' }, take: 10000, select: { id: true, donationId: true, amountPaise: true, status: true, createdAt: true, decidedAt: true } });
      header = ['refund_id', 'donation_id', 'amount_inr', 'status', 'created_at', 'decided_at'];
      rows = r.map((x) => [x.id, x.donationId, (x.amountPaise / 100).toFixed(2), x.status, x.createdAt.toISOString(), x.decidedAt?.toISOString() ?? '']);
      break;
    }
    case 'audit': {
      const a = await db.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10000, select: { id: true, actorId: true, action: true, entityType: true, entityId: true, createdAt: true } });
      header = ['id', 'actor_id', 'action', 'entity_type', 'entity_id', 'created_at'];
      rows = a.map((x) => [x.id, x.actorId, x.action, x.entityType, x.entityId, x.createdAt.toISOString()]);
      break;
    }
  }
  await audit({ actorId: args.actorId, action: 'report.exported', entityType: 'Report', entityId: args.type, metadata: { rows: rows.length }, ip: args.ip });
  const lines = [header.map(csvSafe).join(','), ...rows.map((r) => r.map(csvSafe).join(','))];
  return lines.join('\n');
}
