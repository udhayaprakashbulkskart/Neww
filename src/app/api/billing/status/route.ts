import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { postFeeStatus } from '@/lib/services/billing';

export const dynamic = 'force-dynamic';

/** Post-fee status for the signed-in user: whether the dashboard is open and how many posts are paid for. */
export const GET = handle(async () => {
  const user = await requireUser();
  return json(await postFeeStatus(user.id));
});
