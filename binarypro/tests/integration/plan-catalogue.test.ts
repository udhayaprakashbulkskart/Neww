import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { updatePlan, loadEffectivePlans } from '@/lib/server/plans';
import { membershipPrice } from '@/lib/server/membership';
import { startMembershipCheckout, handleCapturedEvent } from '@/lib/server/payments';
import { DomainError } from '@/lib/server/errors';
import { makeUser, resetDb } from './helpers';

const current = {
  name: 'Gold', priceInrMinor: 299_900n, durationDays: 365, couponMaxPercent: 30, adViewsPerDay: 15,
  benefits: ['Shop with 30% cashback coupons'], active: true,
};

describe('membership catalogue (database)', () => {
  beforeEach(async () => {
    await resetDb();
    // resetDb truncates everything; re-seed the four packages the migration would have inserted.
    for (const [tier, name, price, cap, ads] of [['BASIC', 'Basic', 0n, 10, 5], ['SILVER', 'Silver', 99_900n, 20, 10], ['GOLD', 'Gold', 299_900n, 30, 15], ['PLATINUM', 'Platinum', 999_900n, 50, 20]] as const) {
      await db.membershipPlan.create({ data: { tier, name, priceInrMinor: price, durationDays: 365, couponMaxPercent: cap, adViewsPerDay: ads, benefits: [], active: true } });
    }
  });

  it('an admin price change applies to new purchases', async () => {
    const admin = await makeUser({ name: 'Admin', role: 'ADMIN' });
    await updatePlan('GOLD', { ...current, priceInrMinor: 350_000n }, admin.id);
    expect(await membershipPrice('GOLD', 'INR')).toBe(350_000n);
    const plans = await loadEffectivePlans();
    expect(plans.GOLD.priceInrMinor).toBe(350_000n);
  });

  it('writes an audit entry with before and after values', async () => {
    const admin = await makeUser({ name: 'Admin', role: 'ADMIN' });
    await updatePlan('GOLD', { ...current, priceInrMinor: 350_000n }, admin.id);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: 'plan.updated', targetId: 'GOLD' } });
    const meta = log.meta as { before: { priceInrMinor: string }; after: { priceInrMinor: string } };
    expect(meta.before.priceInrMinor).toBe('299900');
    expect(meta.after.priceInrMinor).toBe('350000');
  });

  it('rejects an invalid coupon cap and leaves the stored plan unchanged', async () => {
    const admin = await makeUser({ name: 'Admin', role: 'ADMIN' });
    await expect(updatePlan('GOLD', { ...current, couponMaxPercent: 40 }, admin.id)).rejects.toBeInstanceOf(DomainError);
    expect((await db.membershipPlan.findUniqueOrThrow({ where: { tier: 'GOLD' } })).couponMaxPercent).toBe(30);
  });

  it('refuses checkout for a package that is switched off', async () => {
    const admin = await makeUser({ name: 'Admin', role: 'ADMIN' });
    const member = await makeUser({ name: 'Buyer', tier: 'BASIC' });
    await updatePlan('PLATINUM', { ...current, name: 'Platinum', priceInrMinor: 999_900n, couponMaxPercent: 50, adViewsPerDay: 20, active: false }, admin.id);
    await expect(startMembershipCheckout(member.id, 'PLATINUM', 'INR')).rejects.toThrow(/not available/);
  });

  it('a membership purchase creates no commission and no direct or binary ledger entries', async () => {
    const member = await makeUser({ name: 'Buyer', tier: 'BASIC' });
    const sponsor = await makeUser({ name: 'Sponsor', tier: 'GOLD' });
    await db.user.update({ where: { id: member.id }, data: { sponsorId: sponsor.id } });
    const checkout = await startMembershipCheckout(member.id, 'SILVER', 'INR');
    if (checkout.activated) throw new Error('expected a payment');
    await handleCapturedEvent({ id: 'evt_membership_no_commission', type: 'payment.captured', providerRef: checkout.providerRef, amountMinor: checkout.amountMinor.toString(), currency: checkout.currency });
    expect(await db.commission.count()).toBe(0);
    expect(await db.ledgerTransaction.count({ where: { type: { in: ['DIRECT_COMMISSION', 'BINARY_COMMISSION'] } } })).toBe(0);
  });
});
