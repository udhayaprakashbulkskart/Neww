import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { savePrize } from '@/lib/server/milestones';
import { PrizeBody } from '@/lib/domain/prize-form';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('milestones:manage');
    const body = await readJson(req, PrizeBody);
    const prize = await savePrize(params.id, body, user.id);
    return ok({ id: prize.id });
  });
}
