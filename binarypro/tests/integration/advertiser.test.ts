import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { createOwnCampaign, listOwnCampaigns, startTopUp, validateVideoUrl } from '@/lib/server/advertiser';
import { handleCapturedEvent } from '@/lib/server/payments';
import { balanceOf } from '@/lib/server/ledger';
import { accounts } from '@/lib/server/accounts';
import { assertLedgerBalanced, makeUser, resetDb } from './helpers';

const input = {
  title: 'Spring launch',
  advertiser: 'Acme Co',
  videoUrl: 'https://cdn.example.com/spring.mp4',
  durationSec: 15,
  rewardText: '3.00',
  currency: 'INR',
};

describe('advertiser campaigns', () => {
  beforeEach(resetDb);

  it('creates a campaign for review, owned by the advertiser', async () => {
    const adv = await makeUser({ name: 'Adv', role: 'ADVERTISER' });
    const c = await createOwnCampaign(adv.id, input);
    expect(c.status).toBe('PENDING_REVIEW');
    expect(c.ownerId).toBe(adv.id);
    expect(c.rewardMinor).toBe(300n);
  });

  it('refuses accounts without the advertiser role', async () => {
    const member = await makeUser({ name: 'Member' });
    await expect(createOwnCampaign(member.id, input)).rejects.toThrow(/Advertiser account required/);
  });

  it('only accepts https MP4 or WebM links', () => {
    expect(() => validateVideoUrl('http://cdn.example.com/a.mp4')).toThrow(/https/);
    expect(() => validateVideoUrl('https://example.com/watch?v=1')).toThrow(/MP4 or WebM/);
    expect(validateVideoUrl('https://cdn.example.com/a.webm')).toContain('a.webm');
  });

  it('validates duration and reward limits', async () => {
    const adv = await makeUser({ name: 'Adv', role: 'ADVERTISER' });
    await expect(createOwnCampaign(adv.id, { ...input, durationSec: 2 })).rejects.toThrow(/between 5 and 600/);
    await expect(createOwnCampaign(adv.id, { ...input, rewardText: '5000.00' })).rejects.toThrow(/1,000.00/);
  });

  it('shows statistics only for the advertiser’s own campaigns', async () => {
    const a = await makeUser({ name: 'A', role: 'ADVERTISER' });
    const b = await makeUser({ name: 'B', role: 'ADVERTISER' });
    await createOwnCampaign(a.id, input);
    await createOwnCampaign(b.id, { ...input, title: 'Other brand' });
    const rows = await listOwnCampaigns(a.id);
    expect(rows.map((r) => r.title)).toEqual(['Spring launch']);
  });

  it('funds the budget only after a confirmed top-up webhook, and ignores duplicates', async () => {
    const adv = await makeUser({ name: 'Adv', role: 'ADVERTISER' });
    const c = await createOwnCampaign(adv.id, input);
    await db.adCampaign.update({ where: { id: c.id }, data: { status: 'ACTIVE' } });

    const top = await startTopUp(adv.id, c.id, '500.00');
    expect(await balanceOf(db, accounts.advertiserPool(c.id, 'INR').key)).toBe(0n);

    const event = { id: 'evt_topup_1', type: 'payment.captured' as const, providerRef: top.providerRef, amountMinor: '50000', currency: 'INR' };
    await handleCapturedEvent(event);
    expect(await balanceOf(db, accounts.advertiserPool(c.id, 'INR').key)).toBe(50_000n);
    await handleCapturedEvent({ ...event, id: 'evt_topup_2' });
    expect(await balanceOf(db, accounts.advertiserPool(c.id, 'INR').key)).toBe(50_000n);
    await assertLedgerBalanced();
  });

  it('holds a top-up whose amount does not match', async () => {
    const adv = await makeUser({ name: 'Adv', role: 'ADVERTISER' });
    const c = await createOwnCampaign(adv.id, input);
    const top = await startTopUp(adv.id, c.id, '500.00');
    const res = await handleCapturedEvent({ id: 'evt_bad_topup', type: 'payment.captured', providerRef: top.providerRef, amountMinor: '1', currency: 'INR' });
    expect(res.held).toBe(true);
    expect(await balanceOf(db, accounts.advertiserPool(c.id, 'INR').key)).toBe(0n);
  });

  it('will not accept a top-up from someone who does not own the campaign', async () => {
    const owner = await makeUser({ name: 'Owner', role: 'ADVERTISER' });
    const other = await makeUser({ name: 'Other', role: 'ADVERTISER' });
    const c = await createOwnCampaign(owner.id, input);
    await expect(startTopUp(other.id, c.id, '100.00')).rejects.toThrow(/not found/i);
  });
});
