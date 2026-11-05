import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { getDonationForDonor } from '@/lib/services/donations';

export const dynamic = 'force-dynamic';

/** Donor: status of one donation. The UI polls this after checkout until the webhook confirms it. */
export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  return json(await getDonationForDonor(user.id, params.id));
});
