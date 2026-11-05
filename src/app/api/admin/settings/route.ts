import { handle, json, readJson } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { settingSchema } from '@/lib/validation/schemas';
import { getPlatformSettings, setPlatformSetting } from '@/lib/services/admin';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { errors } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  if (!(await hasPermission(user.id, PERMISSIONS.SETTINGS_MANAGE))) throw errors.forbidden();
  return json({ settings: await getPlatformSettings() });
});

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const body = settingSchema.parse(await readJson(req));
  return json(await setPlatformSetting({ actorId: user.id, key: body.key, value: body.value }));
});
