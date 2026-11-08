import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { updateRule } from '@/lib/server/milestones';

export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().min(1).max(120),
  thresholdRupees: z.string().min(1).max(20),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  active: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('milestones:manage');
    const body = await readJson(req, Body);
    const rule = await updateRule(params.id, {
      name: body.name,
      thresholdRupees: body.thresholdRupees,
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      active: body.active,
    }, user.id);
    return ok({ id: rule.id });
  });
}
