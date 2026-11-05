import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { listSaved } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ items: await listSaved(user.id) });
});
