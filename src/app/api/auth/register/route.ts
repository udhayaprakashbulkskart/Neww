import { handle, json, readJson, clientIp } from '@/lib/http';
import { registerSchema } from '@/lib/validation/schemas';
import { registerWithPassword } from '@/lib/services/auth';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** Create an account. Signs the new user in and continues to the user-type choice. */
export const POST = handle(async (req: Request) => {
  const body = registerSchema.parse(await readJson(req));
  const user = await registerWithPassword({
    mobile: body.mobile,
    fullName: body.fullName,
    password: body.password,
    email: body.email,
    ip: clientIp(req),
  });
  const token = await createSessionToken(user.id, user.sessionVersion);
  const res = json({ signedIn: true, next: '/app/user-type' }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
