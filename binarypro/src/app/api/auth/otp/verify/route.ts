import { z } from 'zod';
import { issueSession, setSessionCookie, signInMember, verifyOtp } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
const Body = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().max(80).optional(),
  ref: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, Body);
    const { phone } = await verifyOtp(body.phone, body.code);
    const user = await signInMember(phone, body.name ?? null, body.ref ?? null);
    const token = await issueSession(user.id, user.sessionVersion);
    await setSessionCookie(token);
    return ok({ id: user.id, name: user.name, placed: !!user.parentId });
  });
}
