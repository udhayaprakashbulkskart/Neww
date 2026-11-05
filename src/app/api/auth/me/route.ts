import { handle, json } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/rbac';
import { unreadCount } from '@/lib/services/notifications';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ user: null });
  const perms = await permissionsFor(user.id);
  return json({
    user: { id: user.id, fullName: user.fullName, userType: user.userType, status: user.status, mobileLast4: user.mobileLast4 },
    staffPermissions: Array.from(perms),
    unreadNotifications: await unreadCount(user.id),
  });
});
