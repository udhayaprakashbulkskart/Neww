// Partner offer import and browsing. Imports are all-or-nothing: one invalid row rejects the batch.
import { z } from 'zod';
import { db } from './db';
import { DomainError } from './errors';
import { audit } from './audit';
import { TIERS } from '@/lib/domain/plans';
import { validateOfferUrl } from '@/lib/domain/offers';

export const MAX_IMPORT_ROWS = 10_000;
const CHUNK = 500;

const OfferRow = z.object({
  partnerName: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(160),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional().nullable(),
  discountLabel: z.string().trim().min(2).max(60),
  couponCode: z.string().trim().max(40).optional().nullable(),
  offerUrl: z.string().max(2048),
  minTier: z.enum(TIERS),
  validUntil: z.string().datetime(),
  approvedBy: z.string().trim().min(2).max(120),
  approvalRef: z.string().trim().min(3).max(120),
});

export interface ImportResult { inserted: number; rejected: { row: number; errors: string[] }[] }

/** Validates every row first. Only if all rows pass is anything written. */
export function validateOfferRows(rows: unknown[], now = new Date()) {
  const out: { data: Record<string, unknown>[]; rejected: { row: number; errors: string[] }[] } = { data: [], rejected: [] };
  rows.forEach((raw, i) => {
    const row = i + 1;
    const parsed = OfferRow.safeParse(raw);
    if (!parsed.success) {
      out.rejected.push({ row, errors: parsed.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`) });
      return;
    }
    const url = validateOfferUrl(parsed.data.offerUrl);
    if (!url.ok) {
      out.rejected.push({ row, errors: [url.reason] });
      return;
    }
    const until = new Date(parsed.data.validUntil);
    if (until <= now) {
      out.rejected.push({ row, errors: ['validUntil must be in the future'] });
      return;
    }
    out.data.push({
      partnerName: parsed.data.partnerName,
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description || null,
      discountLabel: parsed.data.discountLabel,
      couponCode: parsed.data.couponCode || null,
      offerUrl: url.url,
      minTier: parsed.data.minTier,
      validUntil: until,
      approvedBy: parsed.data.approvedBy,
      approvalRef: parsed.data.approvalRef,
    });
  });
  return out;
}

export async function importPartnerOffers(rows: unknown[], actorId: string): Promise<ImportResult> {
  if (!Array.isArray(rows) || rows.length === 0) throw new DomainError('EMPTY_IMPORT', 'Send at least one offer', 422);
  if (rows.length > MAX_IMPORT_ROWS) throw new DomainError('IMPORT_TOO_LARGE', `Send at most ${MAX_IMPORT_ROWS} offers per import`, 413);
  const checked = validateOfferRows(rows);
  if (checked.rejected.length > 0) {
    throw new DomainError('IMPORT_REJECTED', `${checked.rejected.length} row(s) failed validation. Nothing was imported. First error: row ${checked.rejected[0].row}: ${checked.rejected[0].errors[0]}`, 422);
  }
  await db.$transaction(
    async (tx) => {
      for (let i = 0; i < checked.data.length; i += CHUNK) {
        await tx.partnerOffer.createMany({ data: checked.data.slice(i, i + CHUNK) as never });
      }
      await audit(tx, { action: 'partner_offers.imported', actorId, meta: { count: checked.data.length } });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return { inserted: checked.data.length, rejected: [] };
}
