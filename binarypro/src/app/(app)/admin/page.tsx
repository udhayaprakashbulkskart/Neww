import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { formatMoney, CURRENCIES } from '@/lib/domain/money';
import { AdminButton, AdminForm } from '@/components/client';
import { Section, Money, Notice } from '@/components/ui';
import { dayKey } from '@/lib/server/time';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const role = user.role as StaffRole;
  const canWithdrawals = can(role, 'withdrawals:decide');
  const canOrders = can(role, 'orders:transition');
  const canRun = can(role, 'commissions:run');
  const canFx = can(role, 'fx:manage');
  const canMerchants = can(role, 'merchants:manage');
  const canAds = can(role, 'ads:review');
  const canFraud = can(role, 'fraud:review');
  if (![canWithdrawals, canOrders, canRun, canFx, canMerchants, canAds, canFraud, can(role, 'users:read')].some(Boolean)) {
    redirect('/dashboard');
  }

  const [withdrawals, orders, campaigns, merchants, coupons, flags, runs, members] = await Promise.all([
    canWithdrawals ? db.withdrawal.findMany({ where: { status: 'REQUESTED' }, include: { user: { select: { name: true, phone: true } } }, orderBy: { requestedAt: 'asc' }, take: 100 }) : [],
    canOrders ? db.order.findMany({ where: { status: { in: ['PAID', 'DELIVERED', 'VERIFIED'] } }, include: { buyer: { select: { name: true } }, merchant: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }) : [],
    canAds ? db.adCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }) : [],
    canMerchants ? db.merchant.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }) : [],
    canMerchants ? db.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }) : [],
    canFraud ? db.fraudFlag.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 50 }) : [],
    canRun ? db.binaryRun.findMany({ orderBy: { ranAt: 'desc' }, take: 5 }) : [],
    can(role, 'users:read') ? db.user.count() : 0,
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4"><div className="label">Members</div><div className="mt-2 text-2xl font-extrabold">{members}</div></div>
        <div className="panel p-4"><div className="label">Withdrawals awaiting review</div><div className="mt-2 text-2xl font-extrabold">{withdrawals.length}</div></div>
        <div className="panel p-4"><div className="label">Open fraud flags</div><div className="mt-2 text-2xl font-extrabold">{flags.length}</div></div>
      </div>

      {can(role, 'staff:manage') && (
        <Section title="Advertiser accounts" subtitle="Grant the advertiser role to an existing account. The member must create their account first.">
          <AdminForm url="/api/admin/advertisers" submitLabel="Grant advertiser role" fields={[{ name: 'email', label: 'Account email', type: 'email', placeholder: 'brand@example.com' }]} />
        </Section>
      )}

      {canWithdrawals && (
        <Section title="Withdrawal requests" subtitle="Approve only after bank transfer. Reject returns the money to the wallet.">
          {withdrawals.length === 0 ? <p className="text-sm text-[#a39a86]">Nothing to review.</p> : (
            <table className="table w-full text-sm">
              <thead><tr><th>Member</th><th>Amount</th><th>Requested</th><th>Decision</th></tr></thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td>{w.user.name}<div className="text-xs text-[#6f6758]">{w.user.phone}</div></td>
                    <td><Money minor={w.amountMinor} currency={w.currency} /></td>
                    <td>{w.requestedAt.toLocaleString('en-IN')}</td>
                    <td className="flex gap-2">
                      <AdminButton url={`/api/admin/withdrawals/${w.id}`} body={{ decision: 'APPROVE' }} label="Approve" confirm="Confirm the bank transfer has been made." />
                      <AdminButton url={`/api/admin/withdrawals/${w.id}`} body={{ decision: 'REJECT' }} label="Reject" tone="danger" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {canOrders && (
        <Section title="Orders and commission release" subtitle="Verify a delivered order once its 7-day return window has closed. Returns reverse everything released.">
          {orders.length === 0 ? <p className="text-sm text-[#a39a86]">No active orders.</p> : (
            <table className="table w-full text-sm">
              <thead><tr><th>Order</th><th>Buyer</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.id.slice(0, 10)}…<div className="font-sans text-[#6f6758]">{o.merchant.name}</div></td>
                    <td>{o.buyer.name}</td>
                    <td><Money minor={o.subtotalMinor} currency={o.currency} /></td>
                    <td>{o.status}{o.commissionBlocked && <div className="text-xs text-orange-300">Commission withheld: {o.commissionBlocked}</div>}</td>
                    <td className="flex flex-wrap gap-2">
                      {o.status === 'DELIVERED' && <AdminButton url={`/api/orders/${o.id}/verify`} label="Verify" />}
                      {(o.status === 'VERIFIED' || o.status === 'PAID' || o.status === 'DELIVERED') && (
                        <AdminButton url={`/api/orders/${o.id}/return`} label="Return" tone="danger" confirm="Reverse all commissions and cashback for this order?" />
                      )}
                      {o.status === 'PAID' && <AdminButton url={`/api/orders/${o.id}/deliver`} label="Mark delivered" tone="ghost" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {canRun && (
        <Section title="Binary payouts" subtitle={`Runs once per day (UTC). Today: ${dayKey(new Date())}. Re-running the same day is a no-op.`}>
          <div className="flex flex-wrap items-center gap-4">
            <AdminButton url="/api/admin/binary-run" body={{}} label="Run today's binary payout" />
            <div className="text-xs text-[#a39a86]">Recent runs: {runs.map((r) => `${r.periodKey} (${r.payouts} payouts)`).join(' · ') || 'none'}</div>
          </div>
        </Section>
      )}

      {canFx && (
        <Section title="FX rates" subtitle="INR per one unit of each currency. Used for PV, conversions and membership pricing.">
          <AdminForm url="/api/admin/fx" numeric={['inrPerUnit']} submitLabel="Set rate" fields={[
            { name: 'currency', label: 'Currency', select: CURRENCIES.filter((c) => c !== 'INR') as unknown as string[] },
            { name: 'inrPerUnit', label: 'INR per unit', type: 'number', placeholder: '83.50' },
          ]} />
        </Section>
      )}

      {canMerchants && (
        <Section title="Merchants, products and coupons">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <AdminForm url="/api/admin/merchants" submitLabel="Add merchant" fields={[{ name: 'name', label: 'Merchant name' }]} />
              <AdminForm url="/api/admin/merchants" method="PUT" submitLabel="Add product" fields={[
                { name: 'merchantId', label: 'Merchant ID', placeholder: merchants[0]?.id ?? '' },
                { name: 'name', label: 'Product name' },
                { name: 'price', label: 'Price', placeholder: '1999.00' },
                { name: 'currency', label: 'Currency', select: [...CURRENCIES] },
              ]} />
            </div>
            <div className="space-y-4">
              <AdminForm url="/api/admin/coupons" submitLabel="Create cashback coupon" numeric={['percent', 'perUserLimit']} dates={['startsAt', 'endsAt']} extra={{ funding: 'MERCHANT' }} fields={[
                { name: 'code', label: 'Code', placeholder: 'SAVE20' },
                { name: 'merchantId', label: 'Merchant ID' },
                { name: 'percent', label: 'Cashback % (10/20/30/50)', type: 'number' },
                { name: 'maxCashback', label: 'Max cashback', placeholder: '500.00' },
                { name: 'minOrder', label: 'Min order', placeholder: '0.00' },
                { name: 'budget', label: 'Budget', placeholder: '10000.00' },
                { name: 'currency', label: 'Currency', select: [...CURRENCIES] },
                { name: 'perUserLimit', label: 'Uses per member', type: 'number' },
                { name: 'startsAt', label: 'Starts', type: 'datetime-local' },
                { name: 'endsAt', label: 'Ends', type: 'datetime-local' },
              ]} />
              <div className="text-xs text-[#a39a86]">
                Coupons: {coupons.map((c) => `${c.code} ${c.percent}% (${formatMoney(c.maxCashbackMinor, c.currency)} cap)`).join(' · ') || 'none'}
              </div>
            </div>
          </div>
        </Section>
      )}

      {canAds && (
        <Section title="Advertising campaigns" subtitle="A campaign pays viewers only from its funded budget. Activate after content review.">
          <AdminForm url="/api/admin/campaigns" numeric={['durationSec']} submitLabel="Create campaign" fields={[
            { name: 'advertiser', label: 'Advertiser' },
            { name: 'title', label: 'Title' },
            { name: 'videoUrl', label: 'Video URL (https)', placeholder: 'https://…' },
            { name: 'durationSec', label: 'Duration (seconds)', type: 'number' },
            { name: 'rewardMinor', label: 'Reward per view', placeholder: '3.00' },
            { name: 'currency', label: 'Currency', select: [...CURRENCIES] },
          ]} />
          <div className="mt-6 space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0c0a06] p-3">
                <div><div className="font-bold">{c.title}</div><div className="text-xs text-[#a39a86]">{c.advertiser} · {c.status} · {c.id}</div></div>
                <div className="flex flex-wrap gap-2">
                  {c.status !== 'ACTIVE' && <AdminButton url="/api/admin/campaigns" method="PATCH" body={{ campaignId: c.id, action: 'ACTIVATE' }} label="Activate" />}
                  {c.status === 'ACTIVE' && <AdminButton url="/api/admin/campaigns" method="PATCH" body={{ campaignId: c.id, action: 'PAUSE' }} label="Pause" tone="ghost" />}
                  <AdminButton url="/api/admin/campaigns" method="PATCH" body={{ campaignId: c.id, action: 'END' }} label="End" tone="danger" />
                </div>
              </div>
            ))}
          </div>
          {can(role, 'ads:fund') && campaigns.length > 0 && (
            <div className="mt-6">
              <AdminForm url="/api/admin/campaigns" method="PATCH" submitLabel="Add advertiser funds" extra={{ action: 'FUND' }} fields={[
                { name: 'campaignId', label: 'Campaign ID', placeholder: campaigns[0]!.id },
                { name: 'amount', label: 'Amount', placeholder: '5000.00' },
              ]} />
            </div>
          )}
        </Section>
      )}

      {canFraud && (
        <Section title="Fraud review queue" subtitle="Flags never move money by themselves. Review each one and act manually.">
          {flags.length === 0 ? <Notice>No open flags.</Notice> : (
            <ul className="space-y-2 text-sm">
              {flags.map((f) => (
                <li key={f.id} className="rounded-lg bg-[#0c0a06] px-3 py-2"><span className="font-bold text-orange-300">{f.kind}</span> · {f.detail} · {f.createdAt.toLocaleString('en-IN')}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {can(role, 'users:read') && (
        <Section title="Ranks">
          <AdminButton url="/api/admin/ranks" body={{}} label="Recalculate ranks" />
        </Section>
      )}
    </div>
  );
}
