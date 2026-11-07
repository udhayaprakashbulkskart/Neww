import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { startTopUp } from '@/lib/server/advertiser';

export const runtime = 'nodejs';
const Body = z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('campaigns:own');
    const body = await readJson(req, Body);
    return ok(await startTopUp(user.id, params.id, body.amount), 201);
  });
}
