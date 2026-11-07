import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission, requireUser, handle, ok, readJson } from '@/lib/server/http';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { DomainError } from '@/lib/server/errors';
import { audit } from '@/lib/server/audit';
import { CURRENCIES, parseMinor } from '@/lib/domain/money';
import { fundCampaign } from '@/lib/server/ads';

export const runtime = 'nodejs';
const Create = z.object({
  advertiser: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(160),
  videoUrl: z.string().url().startsWith('https://'),
  durationSec: z.number().int().min(5).max(600),
  rewardMinor: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.enum(CURRENCIES),
});
const Action = z.object({
  campaignId: z.string().min(1),
  action: z.enum(['ACTIVATE', 'PAUSE', 'END', 'FUND']),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export async function GET() {
  return handle(async () => {
    await requirePermission('ads:review');
    return ok({ campaigns: await db.adCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('ads:review');
    const body = await readJson(req, Create);
    const campaign = await db.adCampaign.create({
      data: { ...body, rewardMinor: parseMinor(body.rewardMinor) },
    });
    await db.$transaction((tx) => audit(tx, { action: 'ad.created', actorId: user.id, targetId: campaign.id }));
    return ok(campaign, 201);
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(req, Action);
    if (body.action === 'FUND') {
      if (!can(user.role as StaffRole, 'ads:fund')) throw new DomainError('FORBIDDEN', 'Finance permission required', 403);
      if (!body.amount) throw new DomainError('VALIDATION', 'Amount is required', 422);
      return ok(await fundCampaign(body.campaignId, parseMinor(body.amount), user.id));
    }
    if (!can(user.role as StaffRole, 'ads:review')) throw new DomainError('FORBIDDEN', 'Review permission required', 403);
    const status = body.action === 'ACTIVATE' ? 'ACTIVE' : body.action === 'PAUSE' ? 'PAUSED' : 'ENDED';
    const updated = await db.adCampaign.update({ where: { id: body.campaignId }, data: { status } });
    await db.$transaction((tx) => audit(tx, { action: `ad.${status.toLowerCase()}`, actorId: user.id, targetId: body.campaignId }));
    return ok(updated);
  });
}
