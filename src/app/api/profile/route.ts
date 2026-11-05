import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { getProfile, updateProfile } from '@/lib/services/profile';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  return json(await getProfile(user.id));
});

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  return json(await updateProfile(user.id, body, clientIp(req)));
});
