import { handle, clientIp, errors } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { exportSchema } from '@/lib/validation/schemas';
import { exportCsv } from '@/lib/services/admin';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = exportSchema.safeParse({ type: new URL(req.url).searchParams.get('type') });
  if (!parsed.success) throw errors.badRequest('Choose a valid export type.');
  const csv = await exportCsv({ actorId: user.id, type: parsed.data.type, ip: clientIp(req) });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="helptrust-${parsed.data.type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
