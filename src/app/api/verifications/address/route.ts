import { handle, json, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { startAddressVerification } from '@/lib/services/verification';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  return json(await startAddressVerification(user.id, clientIp(req)));
});
