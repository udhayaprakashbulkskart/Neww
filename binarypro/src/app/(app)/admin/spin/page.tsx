import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { formatMoney } from '@/lib/domain/money';
import { spinAdminOverview } from '@/lib/server/spin-admin';
import { resolveUserId } from '@/lib/server/audit-view';
import { SpinSettingsForm, RewardCreateForm, RewardEditor, SlotEditor, SlotCreateForm, PoolFundForm, RedemptionActions } from '@/components/admin/spin-admin';
import { Section, Notice } from '@/components/ui';
import { TIER_LABEL } from '@/lib/domain/spin';

export const dynamic = 'force-dynamic';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16);

export default async function SpinAdminPage({ searchParams }: { searchParams: { user?: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const role = user.role as StaffRole;
  const canManage = can(role, 'spin:manage');
  const canRedeem = can(role, 'spin:redeem');
  if (!canManage && !canRedeem) redirect('/dashboard');

  const userFilter = searchParams.user?.trim() || '';
  const userId = userFilter ? await resolveUserId(userFilter) : null;
  const overview = await spinAdminOverview({ userId: userId ?? undefined });
  const rewardOptions = overview.rewards.map((r) => ({ id: r.id, name: r.name }));
  const from = daysAgo(30);
  const to = today();
  const exp = (report: string) => `/api/admin/spin/export?report=${report}&from=${from}&to=${to}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Spin &amp; Win</h1>
          <p className="text-sm text-[#a39a86]">Wheel settings, rewards, redemptions and reports. Membership fees never fund rewards.</p>
        </div>
        <Link href="/admin" className="text-sm underline">Back to admin</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4"><div className="label">Status</div><div className="mt-2 text-xl font-bold">{overview.settings.enabled ? 'Enabled' : 'Paused'}</div><div className="text-xs text-[#8f8672]">Cooldown {overview.settings.cooldownDays} days</div></div>
        <div className="panel p-4"><div className="label">Cash rewards</div><div className="mt-2 text-xl font-bold">{overview.cashSwitchOn ? 'Platform switch on' : 'Switched off'}</div><div className="text-xs text-[#8f8672]">Set SPIN_CASH_ENABLED only after legal approval</div></div>
        <div className="panel p-4"><div className="label">Reward pool balance</div><div className="mt-2 text-xl font-bold">{formatMoney(overview.poolMinor, 'INR')}</div><div className="text-xs text-[#8f8672]">Only verified external deposits</div></div>
      </div>

      {canManage && (
        <Section title="Wheel settings" subtitle="Turn Spin & Win on or off, and set the cooldown between spins for each member.">
          <SpinSettingsForm enabled={overview.settings.enabled} cooldownDays={overview.settings.cooldownDays} />
        </Section>
      )}

      {canManage && (
        <Section title="Membership eligibility and wheel segments" subtitle="Each membership tier has its own wheel. A segment appears only when it is on and its reward is live.">
          <div className="space-y-6">
            {(['SILVER', 'GOLD', 'PLATINUM'] as const).map((tier) => {
              const rows = overview.slots.filter((s) => s.tier === tier);
              return (
                <div key={tier}>
                  <h3 className="mb-2 font-semibold">{TIER_LABEL[tier]}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-[#a39a86]"><tr><th className="py-2">Reward</th><th>Weight</th><th>Status</th><th>Save</th></tr></thead>
                      <tbody>
                        {rows.map((s) => <SlotEditor key={s.id} slot={s} />)}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            <SlotCreateForm rewards={rewardOptions} />
          </div>
        </Section>
      )}

      {canManage && (
        <Section title="Rewards" subtitle="Badges and vouchers can be switched on at any time. Cash rewards stay locked until legally approved and funded.">
          <div className="space-y-3">
            {overview.rewards.map((r) => (
              <div key={r.id}>
                <RewardEditor cashSwitchOn={overview.cashSwitchOn} reward={{
                  id: r.id, name: r.name, description: r.description, kind: r.kind, amountMinor: r.amountMinor.toString(), active: r.active,
                  cashLegalRef: r.cashLegalRef, cashFundingRef: r.cashFundingRef, cashActivatedAt: r.cashActivatedAt?.toISOString() ?? null,
                }} />
                <div className="mt-1 text-xs text-[#8f8672]">Wins {r.wins}{r.kind === 'CASH' ? ` · Paid ${formatMoney(r.paidMinor, 'INR')}` : ''}</div>
              </div>
            ))}
            <RewardCreateForm />
          </div>
        </Section>
      )}

      {canManage && (
        <Section title="Reward pool" subtitle="Record a deposit only after you have verified the money in the bank.">
          <div className="mb-4 text-sm">Balance: <span className="font-semibold">{formatMoney(overview.poolMinor, 'INR')}</span></div>
          <PoolFundForm />
        </Section>
      )}

      {canRedeem && (
        <Section title="Reward redemptions" subtitle="Voucher requests awaiting a decision or a voucher code. Oldest first.">
          {overview.queue.length === 0 ? <Notice>No redemptions are waiting.</Notice> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[#a39a86]"><tr><th className="py-2">Requested</th><th>Member</th><th>Reward</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {overview.queue.map((q) => (
                    <tr key={q.id} className="border-t border-white/5 align-top">
                      <td className="py-2 whitespace-nowrap">{when(new Date(q.at))}</td>
                      <td className="break-all">{q.user}</td>
                      <td>{q.reward}</td>
                      <td>{q.status}</td>
                      <td><RedemptionActions id={q.id} status={q.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      <Section
        title="Spin records"
        subtitle={`Newest first, up to ${overview.spins.length} shown. The log is append-only and cannot be edited.`}
        action={
          <span className="flex flex-wrap gap-3 text-sm">
            {(canManage || canRedeem) && <a className="underline" href={exp('spins')}>Spins CSV</a>}
            {canManage && <a className="underline" href={exp('distribution')}>Distribution CSV</a>}
            {canRedeem && <a className="underline" href={exp('redemptions')}>Redemptions CSV</a>}
          </span>
        }
      >
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">Member (email or id)<input name="user" defaultValue={userFilter} className="input mt-1 block py-1.5 text-sm" /></label>
          <button className="btn btn-ghost px-3 py-1.5 text-xs">Show history</button>
          {userFilter && <Link href="/admin/spin" className="text-xs underline">Clear</Link>}
        </form>
        {userFilter && !userId && <Notice tone="warn">No member matches that search.</Notice>}
        {overview.spins.length === 0 ? <p className="text-sm text-[#8f8672]">No spins yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[#a39a86]"><tr><th className="py-2">When (UTC)</th><th>Member</th><th>Membership</th><th>Reward</th><th>Cash</th><th>Claim</th><th>Redemption</th></tr></thead>
              <tbody>
                {overview.spins.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-1.5 whitespace-nowrap">{when(s.at)}</td>
                    <td className="break-all">{s.user}</td>
                    <td>{s.tier}</td>
                    <td>{s.reward}</td>
                    <td>{s.kind === 'CASH' ? formatMoney(s.amountMinor, 'INR') : '-'}</td>
                    <td>{s.claim ?? '-'}</td>
                    <td>{s.redemption ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {canManage && (
        <Section title="Reward distribution" subtitle="How many times each reward has been won, all time.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-[#a39a86]"><tr><th className="py-2">Reward</th><th>Kind</th><th>Wins</th><th>Cash paid</th></tr></thead>
              <tbody>
                {overview.rewards.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="py-1.5">{r.name}</td>
                    <td>{r.kind}</td>
                    <td>{r.wins}</td>
                    <td>{r.kind === 'CASH' ? formatMoney(r.paidMinor, 'INR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
