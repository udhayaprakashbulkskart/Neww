import { requirePermission, handle, ok } from '@/lib/server/http';
import { evaluateMilestones } from '@/lib/server/milestones';

export const runtime = 'nodejs';

export async function POST() {
  return handle(async () => {
    const user = await requirePermission('milestones:manage');
    return ok(await evaluateMilestones(user.id));
  });
}
