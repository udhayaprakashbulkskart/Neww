import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { formatMoney } from '@/lib/domain/money';
import { businessDayKey, previousBusinessDay } from '@/lib/domain/finance-engine';
import { engineOverview } from '@/lib/server/engine-admin';
import { walletSummary } from '@/lib/server/wallet';
import { resolveUserId } from '@/lib/server/audit-view';
import { CapForm, PolicyForm, SettleForm, ReconcileButton, ServiceCreateForm } from '@/components/admin/engine-admin';
import { Section, Notice, Stat } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  PRODUCT: 'Product sales', SERVICE: 'Service sales', DIRECT_SPONSOR: 'Sponsor-linked (disabled)', BINARY: 'Binary team (disabled)',
};

export default async function EnginePage({ searchParams }: { searchParams: { member?: string; from?: string; to?: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const role = user.role as StaffRole;
  const canManage = can(role, 'engine:manage');
  if (!canManage && !can(role, 'engine:read')) redirect('/dashboard');
  const o = await engineOverview();
  const today = businessDayKey(new Date());
  const yesterday = previousBusinessDay(today);
  const from = searchParams.from || yesterday;
  const to = searchParams.to || yesterday;
  const memberId = searchParams.member?.trim() ? await resolveUserId(searchParams.member.trim()) : null;
  const member = memberId ? await walletSummary(memberId) : null;
  const exp = (report: string, format: string) => `/api/admin/engine/export?report=${report}&format=${format}&from=${from}&to=${to}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Financial engine</h1>
          <p className="text-sm text-[#a39a86]">Daily cap, commission policies, settlement, pending and volume ledgers, refunds, reconciliation and the service catalogue. Every change needs a reason and is audited.</p>
        </div>
        <Link href="/admin/finance" className="text-sm underline">Back to finance</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="panel p-4"><div className="label">Daily cap</div><div className="mt-2 text-xl font-bold">{o.capMinor === null ? 'Not set' : formatMoney(o.capMinor, 'INR')}</div><div className="text-xs text-[#8f8672]">Per member, per business day</div></div>
        <div className="panel p-4"><div className="label">Pending commission</div><div className="mt-2 text-xl font-bold">{formatMoney(o.pendingTotalMinor, 'INR')}</div><div className="text-xs text-[#8f8672]">Owed to members, not yet released</div></div>
        <div className="panel p-4"><div className="label">Volume carried forward</div><div className="mt-2 text-xl font-bold">{formatMoney(o.volumeTotal, 'INR')}</div><div className="text-xs text-[#8f8672]">Not money. No expiry.</div></div>
        <div className="panel p-4"><div className="label">Last reconciliation</div><div className="mt-2 text-xl font-bold">{o.reports[0]?.status ?? 'Never run'}</div><div className="text-xs text-[#8f8672]">{o.reports[0] ? o.reports[0].createdAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : ''}</div></div>
      </div>

      <Notice tone="warn">Sponsor-linked and binary team commission are disabled and cannot be switched on. They await documented legal approval.</Notice>

      {canManage && (
        <Section title="Daily cap" subtitle="The one fixed cap that applies to every eligible account. There is no default: until it is set, nothing is released.">
          <CapForm capRupees={o.capMinor === null ? null : (Number(o.capMinor) / 100).toFixed(2)} />
        </Section>
      )}

      <Section title="Commission policies" subtitle="Each change creates a new version. Earlier versions stay in the history.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[#a39a86]"><tr><th className="py-2">Type</th><th>Version</th><th>Rate</th><th>Active</th><th>Legal approval</th><th>Reason</th></tr></thead>
            <tbody>
              {o.policies.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="py-1.5">{KIND_LABEL[p.kind] ?? p.kind}</td>
                  <td>v{p.version}</td>
                  <td>{(p.rateBps / 100).toFixed(2)}%</td>
                  <td>{p.active ? 'Yes' : 'No'}</td>
                  <td className="font-mono text-xs">{p.legalApprovalRef ?? '-'}</td>
                  <td className="text-xs text-[#8f8672]">{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canManage && <div className="mt-5"><PolicyForm /></div>}
      </Section>

      {canManage && (
        <Section title="Daily settlement" subtitle="Releases pending commission to members' wallets, up to the cap, for one business day that has ended.">
          <SettleForm defaultDay={yesterday} />
        </Section>
      )}

      <Section title="Pending commission" subtitle="Earned, not yet released. Carried forward until released.">
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          <a className="underline" href={exp('pending', 'csv')}>Pending CSV</a>
          <a className="underline" target="_blank" rel="noopener" href={exp('pending', 'pdf')}>Pending PDF</a>
        </div>
        {o.pending.length === 0 ? <p className="text-sm text-[#8f8672]">No pending commission.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[#a39a86]"><tr><th className="py-2">Member</th><th>Email</th><th>Pending</th></tr></thead>
            <tbody>{o.pending.map((r) => <tr key={r.userId} className="border-t border-white/5"><td className="py-1.5">{r.name}</td><td className="break-all">{r.email ?? '-'}</td><td>{formatMoney(r.pendingMinor, 'INR')}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section title="Volume carry-forward" subtitle="Eligible sales volume not yet matched. It is never cash and never expires.">
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          <a className="underline" href={exp('volume', 'csv')}>Volume CSV</a>
          <a className="underline" target="_blank" rel="noopener" href={exp('volume', 'pdf')}>Volume PDF</a>
        </div>
        {o.volume.length === 0 ? <p className="text-sm text-[#8f8672]">No carried volume.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[#a39a86]"><tr><th className="py-2">Member</th><th>Email</th><th>Volume</th></tr></thead>
            <tbody>{o.volume.map((r) => <tr key={r.userId} className="border-t border-white/5"><td className="py-1.5">{r.name}</td><td className="break-all">{r.email ?? '-'}</td><td>{formatMoney(r.volume, 'INR')}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section title="Refunds" subtitle="Each refund reverses the commission and volume of its order.">
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          <a className="underline" href={exp('refunds', 'csv')}>Refunds CSV</a>
          <a className="underline" target="_blank" rel="noopener" href={exp('refunds', 'pdf')}>Refunds PDF</a>
        </div>
        {o.refunds.length === 0 ? <p className="text-sm text-[#8f8672]">No refunds recorded.</p> : (
          <table className="w-full text-xs">
            <thead className="text-left text-[#a39a86]"><tr><th className="py-2">When (UTC)</th><th>Order</th><th>Amount</th><th>Reason</th></tr></thead>
            <tbody>{o.refunds.map((r) => <tr key={r.id} className="border-t border-white/5"><td className="py-1.5">{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td><td className="font-mono">{r.orderId}</td><td>{formatMoney(r.amountMinor, 'INR')}</td><td>{r.reason}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section title="Reconciliation" subtitle="Checks the ledger against the engine records. Each run is kept.">
        {canManage && <div className="mb-4"><ReconcileButton /></div>}
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          <a className="underline" href={exp('reconciliation', 'csv')}>Reconciliation CSV</a>
          <a className="underline" target="_blank" rel="noopener" href={exp('reconciliation', 'pdf')}>Reconciliation PDF</a>
        </div>
        {o.reports.length === 0 ? <p className="text-sm text-[#8f8672]">No reconciliation has been run.</p> : o.reports.slice(0, 1).map((r) => (
          <ul key={r.id} className="space-y-1 text-sm">
            {r.findings.map((f) => <li key={f.check} className={f.ok ? 'text-emerald-300' : 'text-red-300'}>{f.ok ? 'OK' : 'FAIL'}: {f.check} ({f.detail})</li>)}
          </ul>
        ))}
      </Section>

      <Section title="Member balances" subtitle="The four balances, derived from the records. Enter an email or a member id.">
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">Member<input name="member" defaultValue={searchParams.member ?? ''} className="input mt-1 block py-1.5 text-sm" /></label>
          <button className="btn btn-ghost px-3 py-1.5 text-xs">Show balances</button>
        </form>
        {searchParams.member && !memberId && <Notice tone="warn">No member matches that search.</Notice>}
        {member && (
          <div className="grid gap-4 sm:grid-cols-5">
            <Stat label="Available">{formatMoney(member.available, 'INR')}</Stat>
            <Stat label="Pending">{formatMoney(member.pending, 'INR')}</Stat>
            <Stat label="Withdrawable">{formatMoney(member.withdrawable, 'INR')}</Stat>
            <Stat label="Withdrawn">{formatMoney(member.withdrawn, 'INR')}</Stat>
            <Stat label="Reversed">{formatMoney(member.reversed, 'INR')}</Stat>
          </div>
        )}
      </Section>

      {canManage && (
        <Section title="Service catalogue" subtitle="Services offered on the platform. Price changes are recorded with a reason.">
          <ServiceCreateForm />
          <ul className="mt-4 space-y-2 text-sm">
            {o.services.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/5 px-3 py-2">
                <span className="font-semibold">{s.name}</span>
                <span>{formatMoney(s.priceMinor, s.currency)} · {s.active ? 'Active' : 'Inactive'}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <p className="text-xs text-[#6f6758]">Reports for {from} to {to}.</p>
    </div>
  );
}
