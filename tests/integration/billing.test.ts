import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { resetDatabase, makeUser, makeCategory } from './helpers';
import { createDraft } from '@/lib/services/campaigns';
import { startPostFee, markPostFeePaid, postFeeStatus, POST_FEE_PAISE } from '@/lib/services/billing';
import { simulateOrderCapture } from '@/lib/services/payment-events';

beforeAll(async () => {
  await resetDatabase();
  await makeCategory('debt-relief');
});

beforeEach(async () => {
  await db.postFee.deleteMany();
  await db.campaign.deleteMany();
  await db.webhookEvent.deleteMany();
});

describe('post fee paywall', () => {
  it('blocks campaign creation until a post fee is paid', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    await expect(createDraft(ben.id)).rejects.toMatchObject({ status: 402, code: 'PAYMENT_REQUIRED' });
    expect((await postFeeStatus(ben.id)).hasDashboardAccess).toBe(false);
  });

  it('grants the dashboard and one campaign credit only after the verified webhook', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const fee = await startPostFee(ben.id, null);
    expect(fee.amountPaise).toBe(POST_FEE_PAISE);
    expect((await postFeeStatus(ben.id)).hasDashboardAccess).toBe(false);

    await simulateOrderCapture({ orderId: fee.orderId!, amountPaise: POST_FEE_PAISE, ip: null });
    const status = await postFeeStatus(ben.id);
    expect(status.hasDashboardAccess).toBe(true);
    expect(status.availableCredits).toBe(1);
  });

  it('reserves one credit per campaign: a second draft needs a second payment', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const fee = await startPostFee(ben.id, null);
    await simulateOrderCapture({ orderId: fee.orderId!, amountPaise: POST_FEE_PAISE, ip: null });

    const first = await createDraft(ben.id);
    expect((await postFeeStatus(ben.id)).availableCredits).toBe(0);
    await expect(createDraft(ben.id)).rejects.toMatchObject({ status: 402 });
    const reserved = await db.postFee.findFirstOrThrow({ where: { userId: ben.id } });
    expect(reserved.campaignId).toBe(first.id);
  });

  it('never credits a fee twice when the same capture is delivered again', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const fee = await startPostFee(ben.id, null);
    await markPostFeePaid({ orderId: fee.orderId!, paymentId: 'pay_fee_once', amountPaise: POST_FEE_PAISE });
    await markPostFeePaid({ orderId: fee.orderId!, paymentId: 'pay_fee_once', amountPaise: POST_FEE_PAISE });
    expect((await postFeeStatus(ben.id)).paidPosts).toBe(1);
  });

  it('does not credit a fee when the captured amount is wrong', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const fee = await startPostFee(ben.id, null);
    await markPostFeePaid({ orderId: fee.orderId!, paymentId: 'pay_fee_short', amountPaise: 100 });
    expect((await postFeeStatus(ben.id)).hasDashboardAccess).toBe(false);
  });
});
