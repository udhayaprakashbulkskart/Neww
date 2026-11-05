import { handle, json } from '@/lib/http';
import { requireUser, SESSION_COOKIE } from '@/lib/auth/session';
import { signOutAll } from '@/lib/services/profile';
import { clientIp } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  await signOutAll(user.id, clientIp(req));
  const res = json({ signedOut: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
