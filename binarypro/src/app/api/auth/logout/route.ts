import { cookies } from 'next/headers';
import { handle, ok, assertSameOrigin } from '@/lib/server/http';
import { SESSION_COOKIE } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    cookies().delete(SESSION_COOKIE);
    return ok({ signedOut: true });
  });
}
