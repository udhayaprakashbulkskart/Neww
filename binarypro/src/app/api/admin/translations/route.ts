// Admin: wording overrides on top of the shipped dictionaries. An empty value removes an override.
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { audit } from '@/lib/server/audit';
import { invalidateLocaleCache } from '@/lib/server/locale';
import { LOCALES } from '@/lib/i18n/locales';
import { en } from '@/lib/i18n/messages/en';
import { DomainError } from '@/lib/server/errors';

export const runtime = 'nodejs';

const Body = z.object({
  items: z.array(z.object({
    locale: z.enum(LOCALES),
    key: z.string().max(120),
    value: z.string().max(1000),
  })).min(1).max(500),
});

export async function GET() {
  return handle(async () => {
    await requirePermission('locale:manage');
    const rows = await db.translationOverride.findMany({ orderBy: [{ locale: 'asc' }, { key: 'asc' }] });
    return ok({ rows, keys: Object.keys(en) });
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requirePermission('locale:manage');
    const body = await readJson(req, Body);
    const known = new Set(Object.keys(en));
    for (const item of body.items) {
      if (!known.has(item.key)) throw new DomainError('UNKNOWN_KEY', `Unknown text key: ${item.key}`, 400);
      // Placeholders such as {amount} must be whole words in braces; stray braces are rejected.
      if (!/^(?:[^{}]|\{\w+\})*$/.test(item.value)) throw new DomainError('BAD_PLACEHOLDER', `Malformed placeholder in ${item.key}`, 400);
    }
    await db.$transaction(async (tx) => {
      for (const item of body.items) {
        const value = item.value.trim();
        if (value === '') {
          await tx.translationOverride.deleteMany({ where: { locale: item.locale, key: item.key } });
        } else {
          await tx.translationOverride.upsert({
            where: { locale_key: { locale: item.locale, key: item.key } },
            create: { locale: item.locale, key: item.key, value, updatedBy: user.id },
            update: { value, updatedBy: user.id },
          });
        }
      }
      await audit(tx, { action: 'translations.updated', actorId: user.id, targetId: 'translations', meta: { count: body.items.length } });
    });
    invalidateLocaleCache();
    return ok({ saved: body.items.length });
  });
}
