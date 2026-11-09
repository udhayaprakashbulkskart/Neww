import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { getLocaleConfig } from '@/lib/server/locale';
import { displayRates } from '@/lib/server/fx-provider';
import { db } from '@/lib/server/db';
import { MESSAGES } from '@/lib/i18n/messages';
import { LOCALES, type Locale } from '@/lib/i18n/locales';
import { Section, Notice } from '@/components/ui';
import { LocaleSettingsForm, FxRefreshButton, TranslationEditor } from '@/components/admin/locale-admin';

export const dynamic = 'force-dynamic';

export default async function LocaleAdminPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const role = user.role as StaffRole;
  if (!can(role, 'locale:manage')) redirect('/admin');
  const [config, fx, overrides] = await Promise.all([
    getLocaleConfig(),
    displayRates(),
    db.translationOverride.findMany({ orderBy: [{ locale: 'asc' }, { key: 'asc' }] }),
  ]);
  const shipped: Record<Locale, Record<string, string>> = MESSAGES;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Languages, countries and currency</h1>
          <p className="text-sm text-[#a39a86]">Control which countries, languages and display currencies visitors can use. Payments always stay in INR.</p>
        </div>
        <Link href="/admin" className="text-sm underline">Back to admin</Link>
      </div>

      <Section title="Countries, languages and currencies" subtitle="Disabled options are hidden from visitors. Visitors from a disabled country see the default country.">
        <LocaleSettingsForm initial={config} />
      </Section>

      <Section title="Exchange rates" subtitle="Used only for approximate prices. Transactions keep their original amounts and currency.">
        <div className="space-y-4">
          {fx.stale && <Notice tone="warn">Rates are missing or older than 36 hours.</Notice>}
          <FxRefreshButton stale={fx.stale} />
          <table className="w-full text-sm">
            <thead className="text-left text-[#a39a86]">
              <tr><th className="py-2">Currency</th><th>INR per 1 unit</th><th>Source</th><th>Last updated</th></tr>
            </thead>
            <tbody>
              {fx.rows.map((r) => (
                <tr key={r.currency} className="border-t border-[#2a2116]">
                  <td className="py-2">{r.currency}</td>
                  <td>{(Number(r.rateE8) / 1e8).toFixed(4)}</td>
                  <td>{r.source}</td>
                  <td>{(r.fetchedAt ?? r.updatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Translations" subtitle="The shipped text is complete for every language. Use this to refine wording; an empty field keeps the shipped text.">
        <TranslationEditor overrides={overrides.map((o) => ({ locale: o.locale, key: o.key, value: o.value }))} shipped={shipped} />
      </Section>
    </div>
  );
}
