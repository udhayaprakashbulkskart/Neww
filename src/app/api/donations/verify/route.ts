import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { verifyCheckout } from '@/lib/services/donations';

export const dynamic = 'force-dynamic';

/**
 * Checkout callback. Verifies the signature only. It does NOT mark the donation successful;
 * the signed webhook does that. The browser's claim of success is never trusted.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  return json(await verifyCheckout({ donorId: user.id, body, ip: clientIp(req) }));
});
