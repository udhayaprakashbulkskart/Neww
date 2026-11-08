import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { fundRewardPool } from '@/lib/server/spin';

export const runtime = 'nodejs';
const Body = z.object({ amountRupees: z.string().trim().min(1).max(20), fundingRef: z.string().trim().max(120) });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('spin:manage');
    const body = await readJson(req, Body);
    return ok(await fundRewardPool(body.amountRupees, body.fundingRef, user.id), 201);
  });
}
