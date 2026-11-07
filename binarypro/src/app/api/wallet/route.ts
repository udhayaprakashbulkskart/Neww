import { z } from 'zod';
import { db } from '@/lib/server/db';
import { handle, ok, readJson, requireUser } from '@/lib/server/http';
import { convertWallet, walletBalances } from '@/lib/server/wallet';
import { CURRENCIES, parseMinor } from '@/lib/domain/money';

export const runtime = 'nodejs';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [balances, entries] = await Promise.all([
      walletBalances(user.id),
      db.ledgerEntry.findMany({
        where: { account: { userId: user.id } },
        orderBy: { tx: { createdAt: 'desc' } },
        take: 50,
        include: { tx: { select: { type: true, description: true, createdAt: true } } },
      }),
    ]);
    return ok({ balances, history: entries.map((e) => ({ ...e, amountMinor: e.amountMinor })) });
  });
}

const Convert = z.object({
  from: z.enum(CURRENCIES),
  to: z.enum(CURRENCIES),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(req, Convert);
    const amount = parseMinor(body.amount);
    return ok(await convertWallet(user.id, body.from, body.to, amount));
  });
}
