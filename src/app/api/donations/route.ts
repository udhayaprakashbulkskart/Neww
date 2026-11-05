import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { createDonation, listDonationsForDonor } from '@/lib/services/donations';

export const dynamic = 'force-dynamic';

/** Donor: my donation history. */
export const GET = handle(async () => {
  const user = await requireUser();
  return json({ items: await listDonationsForDonor(user.id) });
});

/** Donor: start a donation. Creates a pending donation and a gateway order. Idempotent. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  return json(await createDonation({ donorId: user.id, body, ip: clientIp(req) }), { status: 201 });
});
