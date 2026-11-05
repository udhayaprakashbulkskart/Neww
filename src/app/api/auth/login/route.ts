import { handle, json, readJson, clientIp } from '@/lib/http';
import { loginSchema } from '@/lib/validation/schemas';
import { loginWithPassword } from '@/lib/services/auth';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const body = loginSchema.parse(await readJson(req));
  const user = await loginWithPassword({ mobile: body.mobile, password: body.password, ip: clientIp(req) });
  const token = await createSessionToken(user.id, user.sessionVersion);
  const res = json({ signedIn: true, next: '/app/home' });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
