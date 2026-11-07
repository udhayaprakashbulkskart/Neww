import { requirePermission, handle, ok } from '@/lib/server/http';
import { recomputeRanks } from '@/lib/server/ranks';

export const runtime = 'nodejs';

export async function POST() {
  return handle(async () => {
    await requirePermission('users:read');
    return ok({ updated: await recomputeRanks() });
  });
}
