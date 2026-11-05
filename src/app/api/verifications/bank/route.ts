import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { submitBankAccount } from '@/lib/services/verification';

export const dynamic = 'force-dynamic';

/** Bank account for payouts. Full account numbers are encrypted and never returned. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  return json(await submitBankAccount(user.id, body, clientIp(req)), { status: 201 });
});
