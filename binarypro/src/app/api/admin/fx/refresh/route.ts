// Admin: fetch live exchange rates from the configured provider and store them.
import { requirePermission, handle, ok } from '@/lib/server/http';
import { refreshLiveRates } from '@/lib/server/fx-provider';

export const runtime = 'nodejs';

export async function POST() {
  return handle(async () => {
    const user = await requirePermission('fx:manage');
    const result = await refreshLiveRates(user.id);
    return ok({ count: result.count, fetchedAt: result.fetchedAt.toISOString(), host: result.host });
  });
}
