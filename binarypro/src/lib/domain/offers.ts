// Partner offer rules. Pure functions, no database access.
import { TIERS, type Tier } from './plans';

/** A member can open an offer when their plan is at least the offer's minimum tier. */
export function canOpenOffer(memberTier: Tier, minTier: Tier): boolean {
  return TIERS.indexOf(memberTier) >= TIERS.indexOf(minTier);
}

/** Partner links must be https, without embedded credentials, and at most 2048 characters. */
export function validateOfferUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  if (raw.length > 2048) return { ok: false, reason: 'Link is too long' };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'Link is not a valid URL' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'Partner links must use https' };
  if (url.username || url.password) return { ok: false, reason: 'Links must not contain login details' };
  return { ok: true, url: url.toString() };
}

/** Tier required for a given plan price-band label, used for display. */
export function tierLabel(tier: Tier): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}
