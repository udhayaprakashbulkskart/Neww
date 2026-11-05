import { z } from 'zod';
import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { assignRole } from '@/lib/services/admin';

export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().min(10).max(40),
  roleKey: z.enum(['SUPER_ADMIN', 'VERIFICATION_OFFICER', 'FINANCE_OFFICER', 'SUPPORT_AGENT', 'FRAUD_ANALYST']),
  remove: z.boolean().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = schema.parse(await readJson(req));
  return json(await assignRole({ actorId: user.id, userId: body.userId, roleKey: body.roleKey, remove: body.remove, ip: clientIp(req) }));
});
