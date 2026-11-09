import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { makeUser, makeMerchantWithProduct, resetDb } from './helpers';

describe('financial engine database guards', () => {
  beforeEach(resetDb);

  it('refuses an active binary or sponsor policy, even if application code tried', async () => {
    await expect(db.commissionPolicy.create({ data: { kind: 'BINARY', version: 1, rateBps: 500, active: true, legalApprovalRef: 'LEGAL-APPROVED-1', reason: 'attempt' } })).rejects.toThrow(/policy_sponsor_binary_disabled|check constraint/);
    await expect(db.commissionPolicy.create({ data: { kind: 'DIRECT_SPONSOR', version: 1, rateBps: 500, active: true, legalApprovalRef: 'LEGAL-APPROVED-1', reason: 'attempt' } })).rejects.toThrow(/check constraint/);
  });

  it('refuses activation of a product policy without a legal approval reference', async () => {
    await expect(db.commissionPolicy.create({ data: { kind: 'PRODUCT', version: 1, rateBps: 300, active: true, reason: 'no approval' } })).rejects.toThrow(/policy_active_needs_approval/);
  });

  it('never edits a policy version: a new version is created instead', async () => {
    const p = await db.commissionPolicy.create({ data: { kind: 'PRODUCT', version: 1, rateBps: 300, active: false, reason: 'draft' } });
    await expect(db.commissionPolicy.update({ where: { id: p.id }, data: { rateBps: 900 } })).rejects.toThrow(/append-only/);
    await expect(db.commissionPolicy.delete({ where: { id: p.id } })).rejects.toThrow(/append-only/);
  });

  it('rejects a daily cap of zero or less', async () => {
    await expect(db.dailyCapSetting.create({ data: { id: 'default', capMinor: 0n, updatedAt: new Date() } })).rejects.toThrow(/cap_positive_when_set/);
    await db.dailyCapSetting.create({ data: { id: 'default', capMinor: null, updatedAt: new Date() } });
  });

  it('keeps volume, commission and summary rows immutable', async () => {
    const u = await makeUser({ name: 'Immutable' });
    const { product } = await makeMerchantWithProduct(100_000n);
    const order = await db.order.create({ data: { buyerId: u.id, merchantId: product.merchantId, currency: 'INR', subtotalMinor: 100_000n, status: 'VERIFIED' } });
    const v = await db.volumeEntry.create({ data: { userId: u.id, orderId: order.id, kind: 'ACCRUE', pvMinor: 100_000n, dayKey: '2026-11-09' } });
    await expect(db.volumeEntry.update({ where: { id: v.id }, data: { pvMinor: 1n } })).rejects.toThrow(/append-only/);
    await expect(db.volumeEntry.delete({ where: { id: v.id } })).rejects.toThrow(/append-only/);
    await expect(db.volumeEntry.create({ data: { userId: u.id, orderId: order.id, kind: 'ACCRUE', pvMinor: 100_000n, dayKey: '2026-11-09' } })).rejects.toThrow(/Unique|unique/);
  });

  it('rejects a day key that is not a calendar date', async () => {
    const u = await makeUser({ name: 'DayKey' });
    const { product } = await makeMerchantWithProduct(100_000n);
    const order = await db.order.create({ data: { buyerId: u.id, merchantId: product.merchantId, currency: 'INR', subtotalMinor: 100_000n, status: 'VERIFIED' } });
    await expect(db.volumeEntry.create({ data: { userId: u.id, orderId: order.id, kind: 'ACCRUE', pvMinor: 1n, dayKey: '09-11-2026' } })).rejects.toThrow(/volume_day_format/);
  });
});
