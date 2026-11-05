import { handle, json, readJson, clientIp } from '@/lib/http';
import { otpVerifySchema } from '@/lib/validation/schemas';
import { verifyOtpAndSignIn } from '@/lib/services/auth';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const body = otpVerifySchema.parse(await readJson(req));
  const user = await verifyOtpAndSignIn({ mobile: body.mobile, purpose: body.purpose, code: body.code, ip: clientIp(req) });
  const token = await createSessionToken(user.id, user.sessionVersion);
  const res = json({ signedIn: true, next: body.purpose === 'REGISTER' ? '/app/user-type' : '/app/home' });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
