import { z } from 'zod';
import { db } from '@/lib/server/db';
import { handle, ok, readJson, requireUser } from '@/lib/server/http';
import { requestWithdrawal } from '@/lib/server/wallet';
import { CURRENCIES, parseMinor } from '@/lib/domain/money';

export const runtime = 'nodejs';
const Body = z.object({ currency: z.enum(CURRENCIES), amount: z.string().regex(/^\d+(\.\d{1,2})?$/) });

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok({ withdrawals: await db.withdrawal.findMany({ where: { userId: user.id }, orderBy: { requestedAt: 'desc' }, take: 50 }) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(req, Body);
    return ok(await requestWithdrawal(user.id, body.currency, parseMinor(body.amount)), 201);
  });
}
