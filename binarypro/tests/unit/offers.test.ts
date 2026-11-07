import { describe, expect, it } from 'vitest';
import { canOpenOffer, validateOfferUrl } from '@/lib/domain/offers';
import { validateOfferRows } from '@/lib/server/offers';

const good = {
  partnerName: 'Example Store',
  title: 'Spring sale',
  category: 'Fashion',
  discountLabel: '15% off',
  couponCode: 'SPRING15',
  offerUrl: 'https://partner.example.com/sale?ref=crowntree',
  minTier: 'SILVER',
  validUntil: new Date(Date.now() + 86_400_000).toISOString(),
  approvedBy: 'Partnerships team',
  approvalRef: 'APR-2026-0001',
};

describe('offer access by plan', () => {
  it('opens offers at or below the member’s tier', () => {
    expect(canOpenOffer('GOLD', 'SILVER')).toBe(true);
    expect(canOpenOffer('GOLD', 'GOLD')).toBe(true);
    expect(canOpenOffer('SILVER', 'GOLD')).toBe(false);
    expect(canOpenOffer('BASIC', 'BASIC')).toBe(true);
    expect(canOpenOffer('BASIC', 'PLATINUM')).toBe(false);
  });
});

describe('offer links', () => {
  it('accepts https links only', () => {
    expect(validateOfferUrl('https://partner.example.com/x').ok).toBe(true);
    expect(validateOfferUrl('http://partner.example.com/x').ok).toBe(false);
    expect(validateOfferUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateOfferUrl('https://user:pass@partner.example.com').ok).toBe(false);
    expect(validateOfferUrl('not a url').ok).toBe(false);
  });
});

describe('offer import validation', () => {
  it('accepts a valid row', () => {
    const r = validateOfferRows([good]);
    expect(r.rejected).toEqual([]);
    expect(r.data).toHaveLength(1);
  });

  it('reports every bad row with its number and does not return partial data as accepted', () => {
    const r = validateOfferRows([good, { ...good, offerUrl: 'http://insecure.example.com' }, { ...good, approvalRef: '' }]);
    expect(r.data).toHaveLength(1);
    expect(r.rejected.map((x) => x.row)).toEqual([2, 3]);
    expect(r.rejected[0].errors[0]).toMatch(/https/);
  });

  it('rejects expired offers and unknown tiers', () => {
    const past = { ...good, validUntil: new Date(Date.now() - 1000).toISOString() };
    const r = validateOfferRows([past, { ...good, minTier: 'DIAMOND' }]);
    expect(r.rejected).toHaveLength(2);
  });
});
