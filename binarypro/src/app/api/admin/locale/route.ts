// Admin: enabled countries, languages and currencies, default country and the rate provider URL.
import { db } from '@/lib/server/db';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { audit } from '@/lib/server/audit';
import { DEFAULT_LOCALE_CONFIG, LOCALE_CONFIG_KEY, LocaleConfigSchema, getLocaleConfig, invalidateLocaleCache } from '@/lib/server/locale';
import { displayRates } from '@/lib/server/fx-provider';

export const runtime = 'nodejs';

export async function GET() {
  return handle(async () => {
    await requirePermission('locale:manage');
    const [config, fx] = await Promise.all([getLocaleConfig(), displayRates()]);
    return ok({ config, defaults: DEFAULT_LOCALE_CONFIG, fx: { stale: fx.stale, rows: fx.rows } });
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requirePermission('locale:manage');
    const body = await readJson(req, LocaleConfigSchema);
    await db.$transaction(async (tx) => {
      const before = await tx.platformSetting.findUnique({ where: { key: LOCALE_CONFIG_KEY } });
      await tx.platformSetting.upsert({
        where: { key: LOCALE_CONFIG_KEY },
        create: { key: LOCALE_CONFIG_KEY, value: body, updatedBy: user.id },
        update: { value: body, updatedBy: user.id },
      });
      await audit(tx, { action: 'locale.config_changed', actorId: user.id, targetId: LOCALE_CONFIG_KEY, meta: { before: before?.value ?? null, after: body } });
    });
    invalidateLocaleCache();
    return ok({ config: body });
  });
}
