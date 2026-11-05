import { handle, json, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { deleteAccountRequest } from '@/lib/services/profile';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  return json(await deleteAccountRequest(user.id, clientIp(req)));
});
