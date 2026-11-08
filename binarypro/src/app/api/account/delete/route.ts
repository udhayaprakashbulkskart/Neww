import { z } from 'zod';
import { requireUser, handle, ok, readJson, assertSameOrigin } from '@/lib/server/http';
import { deleteAccount } from '@/lib/server/account';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/server/auth';

export const runtime = 'nodejs';
const Body = z.object({ password: z.string().min(1).max(128), confirm: z.literal('DELETE') });

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser();
    const body = await readJson(req, Body);
    await deleteAccount(user.id, body.password);
    cookies().delete(SESSION_COOKIE);
    return ok({ deleted: true });
  });
}
