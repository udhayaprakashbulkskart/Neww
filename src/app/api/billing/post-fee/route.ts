import { handle, json, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { startPostFee } from '@/lib/services/billing';

export const dynamic = 'force-dynamic';

/** Starts the Rs 100 post-fee payment. The credit is granted only when the provider confirms it. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  return json(await startPostFee(user.id, clientIp(req)), { status: 201 });
});
