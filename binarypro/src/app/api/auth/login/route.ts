import { z } from 'zod';
import { loginWithPassword, issueSession, setSessionCookie } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
const Body = z.object({ email: z.string().max(254), password: z.string().min(1).max(128) });

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, Body);
    const user = await loginWithPassword(body.email, body.password);
    await setSessionCookie(await issueSession(user.id, user.sessionVersion));
    return ok({ id: user.id, name: user.name, placed: !!user.parentId });
  });
}
