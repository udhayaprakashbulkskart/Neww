import { handle, json } from '@/lib/http';
import { requireStaff } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/rbac';
import { adminOverview } from '@/lib/services/admin';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireStaff(PERMISSIONS.OVERVIEW_VIEW);
  return json(await adminOverview());
});
