import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { runReconciliation } from '@/lib/server/reconciliation';

export const runtime = 'nodejs';
const Body = z.object({ reason: z.string().trim().min(8).max(300) });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('engine:manage');
    const body = await readJson(req, Body);
    return ok(await runReconciliation(user.id, body.reason));
  });
}
