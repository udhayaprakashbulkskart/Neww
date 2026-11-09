// Saves the visitor's country, language and display currency. Signed-in users keep the choice on their
// account; everyone gets it on this device. A saved choice is never overridden by automatic detection.
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { currentUser } from '@/lib/server/auth';
import { handle, ok, readJson, fail } from '@/lib/server/http';
import { DomainError } from '@/lib/server/errors';
import { getLocaleConfig, getRequestRegion } from '@/lib/server/locale';
import { currencyForCountry, normalizeCountry, normalizeDisplayCurrency, normalizeLanguage } from '@/lib/domain/region';
import { isLocale } from '@/lib/i18n/locales';

export const runtime = 'nodejs';

const Body = z.object({
  country: z.string().max(4).optional(),
  language: z.string().max(8).optional(),
  currency: z.string().max(4).optional(),
  reset: z.boolean().optional(),
});

const COOKIE = 'bp_pref';

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, Body);
    const jar = cookies();
    const user = await currentUser();
    const config = await getLocaleConfig();

    if (body.reset) {
      jar.set(COOKIE, '', { path: '/', maxAge: 0, sameSite: 'lax' });
      if (user) await db.user.update({ where: { id: user.id }, data: { regionChosen: false } });
      return ok({ reset: true });
    }

    const current = await getRequestRegion();
    // A country that was sent must be a supported one; an omitted country keeps the current choice.
    const country = body.country === undefined ? current.prefs.country : normalizeCountry(body.country);
    if (!country) throw new DomainError('COUNTRY_UNKNOWN', 'Unsupported country', 400);
    if (!config.enabledCountries.includes(country)) throw new DomainError('COUNTRY_DISABLED', 'This country is not available', 400);

    const language = body.language === undefined ? current.prefs.language : normalizeLanguage(body.language);
    if (!language || !isLocale(language) || !config.enabledLanguages.includes(language)) {
      throw new DomainError('LANGUAGE_DISABLED', 'This language is not available', 400);
    }

    const currency = body.currency === undefined ? currencyForCountry(country) : normalizeDisplayCurrency(body.currency);
    if (!currency || !config.enabledCurrencies.includes(currency)) {
      throw new DomainError('CURRENCY_DISABLED', 'This currency is not available', 400);
    }

    jar.set(COOKIE, JSON.stringify({ country, language, currency }), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    });

    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: { country, language, displayCurrency: currency, regionChosen: true },
      });
    }
    return ok({ country, language, currency, signedIn: !!user });
  });
}

export function GET() {
  return fail('METHOD_NOT_ALLOWED', 'Use POST', 405);
}
