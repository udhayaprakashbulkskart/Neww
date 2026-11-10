import { json } from '@/lib/http';
import { TEAM_SESSION_COOKIE } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = json({ signedOut: true });
  res.cookies.set(TEAM_SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
