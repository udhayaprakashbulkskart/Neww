import { z } from 'zod';
import { handle, json, readJson } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { listNotifications, markNotificationsRead } from '@/lib/services/profile';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ items: await listNotifications(user.id) });
});

const markSchema = z.object({ id: z.string().min(5).max(40).optional() });

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const body = markSchema.parse(await readJson(req));
  return json(await markNotificationsRead(user.id, body.id));
});
