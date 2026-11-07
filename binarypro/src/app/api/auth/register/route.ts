import { z } from 'zod';
import { registerMember, issueSession, setSessionCookie } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';
import { db } from '@/lib/server/db';
import { DomainError } from '@/lib/server/errors';

export const runtime = 'nodejs';
const Body = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().max(254),
  password: z.string().min(10).max(128),
  ref: z.string().max(64).optional().nullable(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, Body);
    let sponsorId: string | null = null;
    if (body.ref) {
      const sponsor = await db.user.findUnique({ where: { id: body.ref }, select: { id: true } });
      if (!sponsor) throw new DomainError('INVALID_REF', 'The invite link is not valid', 422);
      sponsorId = sponsor.id;
    }
    const user = await registerMember({ name: body.name, email: body.email, password: body.password, sponsorId });
    await setSessionCookie(await issueSession(user.id, user.sessionVersion));
    return ok({ id: user.id, name: user.name, placed: false }, 201);
  });
}
