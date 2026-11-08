import { requirePermission, handle, ok } from '@/lib/server/http';
import { deactivateCashReward } from '@/lib/server/spin';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('spin:manage');
    return ok(await deactivateCashReward(params.id, user.id));
  });
}
