import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { publishPolicy } from '@/lib/server/commission-engine';

export const runtime = 'nodejs';
const Body = z.object({
  kind: z.enum(['PRODUCT', 'SERVICE', 'DIRECT_SPONSOR', 'BINARY']),
  rateBps: z.number().int().min(0).max(10000),
  active: z.boolean(),
  legalApprovalRef: z.string().trim().max(120).nullable().optional(),
  reason: z.string().trim().min(8).max(300),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('engine:manage');
    const body = await readJson(req, Body);
    const p = await publishPolicy({ ...body, legalApprovalRef: body.legalApprovalRef ?? null }, user.id);
    return ok({ id: p.id, version: p.version }, 201);
  });
}
