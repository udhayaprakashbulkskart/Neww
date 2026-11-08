import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { activateCashReward } from '@/lib/server/spin';

export const runtime = 'nodejs';
const Body = z.object({ legalRef: z.string().trim().max(120), fundingRef: z.string().trim().max(120) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('spin:manage');
    const body = await readJson(req, Body);
    const r = await activateCashReward(params.id, body, user.id);
    return ok({ id: r.id, active: r.active });
  });
}
