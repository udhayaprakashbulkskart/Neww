import { z } from 'zod';
import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { startIdentityVerification } from '@/lib/services/verification';

export const dynamic = 'force-dynamic';

const schema = z.object({ consent: z.literal(true) });

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = schema.parse(await readJson(req));
  return json(await startIdentityVerification(user.id, body.consent, clientIp(req)));
});
