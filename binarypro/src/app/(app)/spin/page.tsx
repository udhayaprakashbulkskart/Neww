import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { getSpinState } from '@/lib/server/spin';
import { SpinWheel } from '@/components/spin/spin-wheel';
import { formatMoney } from '@/lib/domain/money';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

function dateText(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

const STATUS_TEXT: Record<string, string> = {
  REQUESTED: 'Requested, awaiting approval',
  APPROVED: 'Approved, being prepared',
  FULFILLED: 'Issued',
  REJECTED: 'Not approved',
};

export default async function SpinPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const state = await getSpinState(user.id);

  const pending = state.history.filter((h) => h.redemptionStatus === 'REQUESTED' || h.redemptionStatus === 'APPROVED');
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Spin &amp; Win</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#8f8672]">Paid members get one spin every {state.cooldownDays} days. Everyone can see the wheel. Membership fees do not fund the rewards.</p>
      </header>

      {!state.enabled && <Notice tone="warn">Spin &amp; Win is paused right now. Your history is still available below.</Notice>}

      <section className="panel p-6 md:p-8">
        <SpinWheel
          segments={state.wheel}
          state={{
            eligible: state.eligible,
            reason: state.reason,
            reasonText: state.reasonText,
            nextEligibleAt: state.nextEligibleAt,
            serverNow: state.serverNow,
            previewOnly: state.previewOnly,
            cooldownDays: state.cooldownDays,
          }}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-5">
          <div className="label">Current membership</div>
          <div className="mt-2 text-lg font-bold">{state.membership.tierLabel}</div>
          <div className="mt-1 text-xs text-[#8f8672]">{state.membership.active ? `Valid until ${dateText(state.membership.expiresAt)}` : state.membership.tier === 'BASIC' ? 'Free account' : 'Membership expired'}</div>
        </div>
        <div className="panel p-5">
          <div className="label">Spin eligibility</div>
          <div className={`mt-2 text-lg font-bold ${state.eligible ? 'text-emerald-300' : 'text-[#f7e09a]'}`}>{state.eligible ? 'Available now' : 'Not available'}</div>
          <div className="mt-1 text-xs text-[#8f8672]">{state.reasonText}</div>
        </div>
        <div className="panel p-5">
          <div className="label">Last spin</div>
          <div className="mt-2 text-lg font-bold">{dateText(state.lastSpinAt)}</div>
        </div>
        <div className="panel p-5">
          <div className="label">Next spin</div>
          <div className="mt-2 text-lg font-bold">{state.nextEligibleAt ? dateText(state.nextEligibleAt) : 'Now'}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Available rewards" subtitle="Badges are yours to keep. Vouchers appear here once issued.">
          {state.badges.length === 0 && pending.length === 0 ? (
            <p className="text-sm text-[#8f8672]">No rewards yet. Spin the wheel to win one.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {state.badges.map((b, i) => (
                <li key={`b${i}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-xs text-emerald-300">Kept</span>
                </li>
              ))}
              {pending.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <span className="font-semibold">{p.rewardName}</span>
                  <span className="text-xs text-[#f7e09a]">{STATUS_TEXT[p.redemptionStatus ?? ''] ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Previous rewards" subtitle="Your last 25 spins, newest first.">
          {state.history.length === 0 ? (
            <p className="text-sm text-[#8f8672]">You have not spun yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-[#a39a86]">
                  <tr><th className="py-2">Date</th><th>Reward</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {state.history.map((h) => (
                    <tr key={h.id} className="border-t border-white/5 align-top">
                      <td className="py-2 whitespace-nowrap">{dateText(h.at)}</td>
                      <td>
                        {h.rewardName}
                        {h.kind === 'CASH' && <div className="text-xs text-[#8f8672]">{formatMoney(BigInt(h.amountMinor), 'INR')}</div>}
                      </td>
                      <td className="text-xs">
                        {h.outcome === 'CREDITED' && 'Credited to wallet'}
                        {h.outcome === 'GRANTED' && 'Badge kept'}
                        {h.outcome === 'REDEMPTION_REQUESTED' && (h.redemptionStatus ? STATUS_TEXT[h.redemptionStatus] : 'Requested')}
                        {h.voucherCode && <div className="mt-1 font-mono text-[#f7e09a]">Code: {h.voucherCode}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
