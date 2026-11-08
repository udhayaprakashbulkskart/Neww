import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { spin, getSpinState, updateSettings, updateSlot, fundRewardPool, activateCashReward, decideRedemption, updateReward, createReward } from '@/lib/server/spin';
import { spinExportTable } from '@/lib/server/spin-admin';
import { balanceOf } from '@/lib/server/ledger';
import { accounts } from '@/lib/server/accounts';
import { dateRange, DAY_MS_FOR_TEST } from './spin-helpers';
import { DomainError } from '@/lib/server/errors';
import { assertLedgerBalanced, makeUser, resetDb } from './helpers';

const DAY = 86_400_000;
const KEY = (n: string) => `spin-key-${n}-abcdefgh`;
const ORIGINAL_ENV = process.env.SPIN_CASH_ENABLED;

async function seed() {
  await db.spinSettings.create({ data: { id: 'default', enabled: true, cooldownDays: 15, updatedAt: new Date() } });
  const rewards = [
    { id: 'b_silver', name: 'Silver badge', kind: 'BADGE' as const, amountMinor: 0n, active: true },
    { id: 'b_gold', name: 'Gold badge', kind: 'BADGE' as const, amountMinor: 0n, active: true },
    { id: 'b_plat', name: 'Platinum badge', kind: 'BADGE' as const, amountMinor: 0n, active: true },
    { id: 'b_lucky', name: 'Lucky badge', kind: 'BADGE' as const, amountMinor: 0n, active: true },
    { id: 'cash_500', name: 'Cash ₹500', kind: 'CASH' as const, amountMinor: 50000n, active: false },
    { id: 'cash_5000', name: 'Cash ₹5,000', kind: 'CASH' as const, amountMinor: 500000n, active: false },
    { id: 'v_shop', name: 'Shop voucher', kind: 'VOUCHER' as const, amountMinor: 0n, active: false },
  ];
  for (const r of rewards) await db.spinReward.create({ data: { ...r, description: 'test reward', updatedAt: new Date() } });
  const slots: ['SILVER' | 'GOLD' | 'PLATINUM', string, number, boolean][] = [
    ['SILVER', 'b_silver', 50, true], ['SILVER', 'b_lucky', 30, true], ['SILVER', 'cash_500', 40, false],
    ['SILVER', 'cash_5000', 20, false], ['SILVER', 'v_shop', 10, false],
    ['GOLD', 'b_gold', 50, true], ['GOLD', 'b_lucky', 30, true],
    ['PLATINUM', 'b_plat', 50, true], ['PLATINUM', 'b_lucky', 30, true],
  ];
  let i = 0;
  for (const [tier, rewardId, weight, active] of slots) {
    i += 1;
    await db.spinSlot.create({ data: { id: `slot_${i}`, tier, rewardId, weight, active, sortOrder: i } });
  }
}

async function member(tier: 'SILVER' | 'GOLD' | 'PLATINUM' | 'BASIC' = 'SILVER', name = 'Member') {
  const paid: 'SILVER' | 'GOLD' | 'PLATINUM' = tier === 'BASIC' ? 'SILVER' : tier;
  const u = await makeUser({ name, tier: paid });
  if (tier === 'BASIC') await db.membership.update({ where: { userId: u.id }, data: { tier: 'BASIC' } });
  return u;
}

async function admin() {
  return makeUser({ name: 'Ops Admin', role: 'ADMIN' });
}

describe('Spin & Win', () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
    delete process.env.SPIN_CASH_ENABLED;
  });
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.SPIN_CASH_ENABLED;
    else process.env.SPIN_CASH_ENABLED = ORIGINAL_ENV;
  });

  it('shows each paid tier its own live wheel, and hides the locked cash segments', async () => {
    const silver = await member('SILVER', 'S');
    const gold = await member('GOLD', 'G');
    const plat = await member('PLATINUM', 'P');
    expect((await getSpinState(silver.id)).wheel.map((w) => w.name).sort()).toEqual(['Lucky badge', 'Silver badge']);
    expect((await getSpinState(gold.id)).wheel.map((w) => w.name).sort()).toEqual(['Gold badge', 'Lucky badge']);
    expect((await getSpinState(plat.id)).wheel.map((w) => w.name).sort()).toEqual(['Lucky badge', 'Platinum badge']);
    const s = await getSpinState(silver.id);
    expect(s.wheel.some((w) => w.kind === 'CASH')).toBe(false);
  });

  it('lets a paid member spin once and records the outcome, with the next eligible time 15 days out', async () => {
    const u = await member('SILVER');
    const now = new Date('2026-11-08T12:00:00Z');
    const r = await spin(u.id, KEY('one'), now);
    expect(r.replayed).toBe(false);
    expect(['Silver badge', 'Lucky badge']).toContain(r.rewardName);
    expect(r.outcome).toBe('GRANTED');
    expect(new Date(r.nextEligibleAt).getTime()).toBe(now.getTime() + 15 * DAY);
    expect(await db.spinSpin.count({ where: { userId: u.id } })).toBe(1);
  });

  it('refuses a second spin before 15 days, and allows it exactly at 15 days', async () => {
    const u = await member('GOLD');
    const t0 = new Date('2026-11-08T12:00:00Z');
    await spin(u.id, KEY('first'), t0);
    await expect(spin(u.id, KEY('second'), new Date(t0.getTime() + 14 * DAY))).rejects.toMatchObject({ code: 'COOLDOWN' });
    const state = await getSpinState(u.id, new Date(t0.getTime() + 14 * DAY));
    expect(state.eligible).toBe(false);
    expect(state.reason).toBe('COOLDOWN');
    const again = await spin(u.id, KEY('third'), new Date(t0.getTime() + 15 * DAY));
    expect(again.replayed).toBe(false);
    expect(await db.spinSpin.count({ where: { userId: u.id } })).toBe(2);
  });

  it('returns the original result for a repeated request key and never spins twice', async () => {
    const u = await member('PLATINUM');
    const now = new Date('2026-11-08T12:00:00Z');
    const first = await spin(u.id, KEY('same'), now);
    const replay = await spin(u.id, KEY('same'), new Date(now.getTime() + 1000));
    expect(replay.replayed).toBe(true);
    expect(replay.spinId).toBe(first.spinId);
    expect(await db.spinSpin.count({ where: { userId: u.id } })).toBe(1);
  });

  it('lets only one of two simultaneous spin requests succeed', async () => {
    const u = await member('SILVER');
    const now = new Date('2026-11-08T12:00:00Z');
    const results = await Promise.allSettled([spin(u.id, KEY('race-a'), now), spin(u.id, KEY('race-b'), now)]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((rejected.reason as DomainError).code).toBe('COOLDOWN');
    expect(await db.spinSpin.count({ where: { userId: u.id } })).toBe(1);
  });

  it('never lets a free member spin, but still shows them the wheel as a preview', async () => {
    const free = await member('BASIC', 'Free');
    await expect(spin(free.id, KEY('free'))).rejects.toMatchObject({ code: 'NOT_MEMBER' });
    const state = await getSpinState(free.id);
    expect(state.previewOnly).toBe(true);
    expect(state.eligible).toBe(false);
    expect(state.wheel.length).toBeGreaterThan(0);
  });

  it('refuses a member whose membership has expired, at the moment of spinning', async () => {
    const u = await member('GOLD');
    await db.membership.update({ where: { userId: u.id }, data: { expiresAt: new Date('2026-01-01T00:00:00Z') } });
    await expect(spin(u.id, KEY('expired'), new Date('2026-11-08T12:00:00Z'))).rejects.toMatchObject({ code: 'MEMBERSHIP_EXPIRED' });
    expect(await db.spinSpin.count({ where: { userId: u.id } })).toBe(0);
  });

  it('stops everything when the administrator switches Spin & Win off', async () => {
    const u = await member('SILVER');
    const a = await admin();
    await updateSettings({ enabled: false }, a.id);
    await expect(spin(u.id, KEY('off'))).rejects.toMatchObject({ code: 'DISABLED' });
    await updateSettings({ enabled: true }, a.id);
    await expect(spin(u.id, KEY('on'))).resolves.toBeDefined();
  });

  it('applies a changed cooldown from the administrator', async () => {
    const u = await member('GOLD');
    const a = await admin();
    await updateSettings({ cooldownDays: 7 }, a.id);
    const t0 = new Date('2026-11-08T12:00:00Z');
    const r = await spin(u.id, KEY('seven'), t0);
    expect(new Date(r.nextEligibleAt).getTime()).toBe(t0.getTime() + 7 * DAY);
    await expect(updateSettings({ cooldownDays: 0 }, a.id)).rejects.toBeInstanceOf(DomainError);
  });

  it('keeps cash rewards locked without the platform switch, and credits the wallet from the reward pool once live', async () => {
    const a = await admin();
    const u = await member('SILVER');
    await fundRewardPool('1000', 'BANK-REF-0001', a.id);
    await expect(activateCashReward('cash_500', { legalRef: 'LEGAL-APPROVAL-001', fundingRef: 'FUND-REF-0001' }, a.id)).rejects.toMatchObject({ code: 'ACTIVATION_BLOCKED' });

    process.env.SPIN_CASH_ENABLED = 'true';
    await activateCashReward('cash_500', { legalRef: 'LEGAL-APPROVAL-001', fundingRef: 'FUND-REF-0001' }, a.id);
    // Only the ₹500 cash segment is live now: badges and voucher are switched off for this test.
    await updateSlot('slot_1', { weight: 50, active: false }, a.id);
    await updateSlot('slot_2', { weight: 30, active: false }, a.id);
    // Activating the reward and enabling its wheel segment are two deliberate steps.
    await updateSlot('slot_3', { weight: 40, active: true }, a.id);
    const r = await spin(u.id, KEY('cash-win'), new Date('2026-11-08T12:00:00Z'));
    expect(r.kind).toBe('CASH');
    expect(r.outcome).toBe('CREDITED');
    expect(await balanceOf(db, accounts.wallet(u.id, 'INR').key)).toBe(50000n);
    expect(await balanceOf(db, accounts.spinPool('INR').key)).toBe(50000n);
    // Membership revenue is never touched by Spin & Win.
    expect(await balanceOf(db, 'REVENUE:MEMBERSHIP:INR')).toBe(0n);
    await assertLedgerBalanced();
  });

  it('will not activate cash without a documented legal and funding reference', async () => {
    const a = await admin();
    process.env.SPIN_CASH_ENABLED = 'true';
    await expect(activateCashReward('cash_500', { legalRef: 'x', fundingRef: 'FUND-REF-0001' }, a.id)).rejects.toMatchObject({ code: 'ACTIVATION_BLOCKED' });
  });

  it('refuses a duplicate funding reference and keeps the pool honest', async () => {
    const a = await admin();
    await fundRewardPool('500', 'BANK-REF-0002', a.id);
    await expect(fundRewardPool('500', 'BANK-REF-0002', a.id)).rejects.toMatchObject({ code: 'DUPLICATE_FUNDING' });
    expect(await balanceOf(db, accounts.spinPool('INR').key)).toBe(50000n);
  });

  it('turns a voucher win into a redemption that staff approve and fulfil with a code', async () => {
    const a = await admin();
    const u = await member('SILVER');
    await updateSlot('slot_1', { weight: 50, active: false }, a.id);
    await updateSlot('slot_2', { weight: 30, active: false }, a.id);
    await db.spinReward.update({ where: { id: 'v_shop' }, data: { active: true } });
    await db.spinSlot.update({ where: { id: 'slot_5' }, data: { active: true } });
    const r = await spin(u.id, KEY('voucher'), new Date('2026-11-08T12:00:00Z'));
    expect(r.outcome).toBe('REDEMPTION_REQUESTED');
    const red = await db.spinRedemption.findUniqueOrThrow({ where: { spinId: r.spinId } });
    expect(red.status).toBe('REQUESTED');
    await expect(decideRedemption(red.id, 'FULFIL', {}, a.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await decideRedemption(red.id, 'APPROVE', {}, a.id);
    await expect(decideRedemption(red.id, 'FULFIL', {}, a.id)).rejects.toMatchObject({ code: 'VALIDATION' });
    await decideRedemption(red.id, 'FULFIL', { voucherCode: 'SHOP-ABC-123' }, a.id);
    const after = await getSpinState(u.id);
    expect(after.history[0]!.redemptionStatus).toBe('FULFILLED');
    expect(after.history[0]!.voucherCode).toBe('SHOP-ABC-123');
  });

  it('makes the spin log append-only', async () => {
    const u = await member('SILVER');
    const r = await spin(u.id, KEY('log'), new Date('2026-11-08T12:00:00Z'));
    await expect(db.spinSpin.update({ where: { id: r.spinId }, data: { rewardName: 'changed' } })).rejects.toThrow(/append-only/);
    await expect(db.spinSpin.delete({ where: { id: r.spinId } })).rejects.toThrow(/append-only/);
  });

  it('rejects malformed request keys and cash rewards created as live', async () => {
    const u = await member('SILVER');
    await expect(spin(u.id, 'short')).rejects.toMatchObject({ code: 'BAD_KEY' });
    const a = await admin();
    await expect(createReward({ name: 'Cash', description: 'cash reward', kind: 'CASH', amountRupees: '500' }, a.id)).rejects.toMatchObject({ code: 'CASH_LOCKED' });
    await expect(updateReward('cash_500', { name: 'Cash ₹500', description: 'text here', active: true }, a.id)).rejects.toMatchObject({ code: 'CASH_LOCKED' });
  });

  it('builds the reports the administrator exports', async () => {
    const u = await member('GOLD');
    await spin(u.id, KEY('report'), new Date('2026-11-08T12:00:00Z'));
    const range = dateRange('2026-11-01', '2026-11-30')!;
    const spins = await spinExportTable('spins', range, null);
    expect(spins.rows.length).toBe(1);
    const dist = await spinExportTable('distribution', range, null);
    expect(dist.rows.find((r) => r[0] === 'Gold badge' || r[0] === 'Lucky badge')).toBeDefined();
    void DAY_MS_FOR_TEST;
  });
});
