// Translation service. Every language is typed against the English key set, so a missing key is a
// build error, not a visible English fallback. Admin overrides are applied on top of the shipped text.
import type { Locale } from '../locales';
import { DEFAULT_LOCALE, directionFor } from '../locales';
import { en, type Messages, type MessageKey } from './en';
import { ar } from './ar';
import { de } from './de';
import { fr } from './fr';
import { ja } from './ja';

export type { Messages, MessageKey };

export const MESSAGES: Record<Locale, Messages> = { en, ar, de, fr, ja };

export type Overrides = Partial<Record<Locale, Partial<Record<MessageKey, string>>>>;

/** Shipped dictionary for a locale, with admin overrides applied. */
export function messagesFor(locale: Locale, overrides?: Overrides): Messages {
  const base = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const extra = overrides?.[locale];
  if (!extra) return base;
  const merged = { ...base };
  for (const key of Object.keys(extra) as MessageKey[]) {
    const value = extra[key];
    if (typeof value === 'string' && value.trim() !== '') merged[key] = value;
  }
  return merged;
}

/** Replaces {name} placeholders. Unknown placeholders are left as written so they are visible in review. */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translatorFor(messages: Messages): Translator {
  return (key, vars) => format(messages[key], vars);
}

export { directionFor };
