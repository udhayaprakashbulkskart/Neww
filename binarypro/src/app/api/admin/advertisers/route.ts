import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { audit } from '@/lib/server/audit';
import { normaliseEmail } from '@/lib/server/auth';
import { DomainError } from '@/lib/server/errors';

export const runtime = 'nodejs';
const Body = z.object({ email: z.string().max(254) });

/** Grants the advertiser role to an existing account. Staff-only (ADMIN). */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requirePermission('staff:manage');
    const body = await readJson(req, Body);
    const email = normaliseEmail(body.email);
    const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) throw new DomainError('NOT_FOUND', 'No account uses that email. Ask them to create one first.', 404);
    if (user.role !== 'MEMBER' && user.role !== 'ADVERTISER') throw new DomainError('ROLE_CONFLICT', 'That account already has a staff role', 409);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { role: 'ADVERTISER' } });
      await audit(tx, { action: 'advertiser.granted', actorId: admin.id, targetId: user.id });
    });
    return ok({ id: user.id, role: 'ADVERTISER' });
  });
}
