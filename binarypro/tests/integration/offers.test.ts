import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { importPartnerOffers } from '@/lib/server/offers';
import { DomainError } from '@/lib/server/errors';
import { makeUser, resetDb } from './helpers';

const row = (i: number, extra: Record<string, unknown> = {}) => ({
  partnerName: 'Example Store',
  title: `Offer ${i}`,
  category: 'Fashion',
  discountLabel: '10% off',
  offerUrl: `https://partner.example.com/offer/${i}`,
  minTier: 'BASIC',
  validUntil: new Date(Date.now() + 86_400_000).toISOString(),
  approvedBy: 'Partnerships team',
  approvalRef: `APR-${i}`,
  ...extra,
});

describe('partner offer import', () => {
  beforeEach(resetDb);

  it('imports a valid batch', async () => {
    const admin = await makeUser({ name: 'Admin', role: 'ADMIN' });
    const res = await importPartnerOffers([row(1), row(2), row(3)], admin.id);
    expect(res.inserted).toBe(3);
    expect(await db.partnerOffer.count()).toBe(3);
  });

  it('writes nothing when any row is invalid', async () => {
    const admin = await makeUser({ name: 'Admin', role: 'ADMIN' });
    const err = await importPartnerOffers([row(1), row(2, { offerUrl: 'http://nope.example.com' })], admin.id).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('IMPORT_REJECTED');
    expect(await db.partnerOffer.count()).toBe(0);
  });

  it('handles a large batch in chunks', async () => {
    const admin = await makeUser({ name: 'Admin', role: 'ADMIN' });
    const rows = Array.from({ length: 1200 }, (_, i) => row(i + 1));
    const res = await importPartnerOffers(rows, admin.id);
    expect(res.inserted).toBe(1200);
    expect(await db.partnerOffer.count()).toBe(1200);
  });
});
