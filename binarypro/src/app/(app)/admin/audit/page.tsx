import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { dateRange } from '@/lib/domain/finance';
import { auditEntries, ledgerHistory, resolveUserId, MAX_ROWS } from '@/lib/server/audit-view';
import { formatMoney } from '@/lib/domain/money';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

const field = 'rounded-lg border border-[#2a2116] bg-[#0e0b06] px-3 py-2 text-sm';

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoUtc(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

type SP = Record<string, string | undefined>;

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const role = user.role as StaffRole;
  const canAudit = can(role, 'audit:read');
  const canLedger = can(role, 'finance:read');
  if (!canAudit && !canLedger) redirect('/dashboard');

  const from = searchParams.from || daysAgoUtc(30);
  const to = searchParams.to || todayUtc();
  const range = dateRange(from, to);
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ from, to });
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    return p.toString();
  };

  const actionFilter = searchParams.action?.trim() || undefined;
  const actorInput = searchParams.actor?.trim() || undefined;
  const targetFilter = searchParams.target?.trim() || undefined;
  const userInput = searchParams.user?.trim() || undefined;
  const txId = searchParams.txId?.trim() || undefined;
  const reference = searchParams.reference?.trim() || undefined;
  const type = searchParams.type?.trim() || undefined;

  const [actorId, userId] = await Promise.all([
    actorInput ? resolveUserId(actorInput) : Promise.resolve(null),
    userInput ? resolveUserId(userInput) : Promise.resolve(null),
  ]);
  const actorNotFound = Boolean(actorInput && !actorId);
  const userNotFound = Boolean(userInput && !userId);

  const audit = range && canAudit && !actorNotFound
    ? await auditEntries(range, { action: actionFilter, actorId: actorId ?? undefined, targetId: targetFilter })
    : [];
  const ledger = range && canLedger && !userNotFound
    ? await ledgerHistory(range, { userId: userId ?? undefined, txId, reference, type })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit log and transactions</h1>
          <p className="text-sm text-[#a39a86]">Every financial and administrative action, and every ledger posting. Read-only.</p>
        </div>
        <Link href="/admin" className="text-sm underline">Back to admin</Link>
      </div>

      <form method="get" className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">From<input type="date" name="from" defaultValue={from} className={`${field} mt-1 w-full`} /></label>
        <label className="text-sm">To<input type="date" name="to" defaultValue={to} className={`${field} mt-1 w-full`} /></label>
        {canAudit && <>
          <label className="text-sm">Action (prefix, e.g. order.)<input name="action" defaultValue={actionFilter} className={`${field} mt-1 w-full`} /></label>
          <label className="text-sm">Actor (email or id)<input name="actor" defaultValue={actorInput} className={`${field} mt-1 w-full`} /></label>
          <label className="text-sm">Target id<input name="target" defaultValue={targetFilter} className={`${field} mt-1 w-full`} /></label>
        </>}
        {canLedger && <>
          <label className="text-sm">Member (email or id)<input name="user" defaultValue={userInput} className={`${field} mt-1 w-full`} /></label>
          <label className="text-sm">Transaction id<input name="txId" defaultValue={txId} className={`${field} mt-1 w-full`} /></label>
          <label className="text-sm">Reference contains<input name="reference" defaultValue={reference} className={`${field} mt-1 w-full`} /></label>
          <label className="text-sm">Type<input name="type" defaultValue={type} className={`${field} mt-1 w-full`} /></label>
        </>}
        <div className="flex items-end"><button className="btn btn-primary" type="submit">Apply filters</button></div>
      </form>

      {!range && <Notice tone="warn">Enter a valid range: both dates, with the end on or after the start.</Notice>}
      {actorNotFound && <Notice tone="warn">No member matches that actor. Showing no audit rows.</Notice>}
      {userNotFound && <Notice tone="warn">No member matches that search. Showing no transactions.</Notice>}

      {canAudit && (
        <Section
          title="Audit log"
          subtitle={`Newest first, up to ${MAX_ROWS} rows. Export keeps these filters.`}
          action={range && (
            <span className="flex gap-3 text-sm">
              <a className="underline" href={`/api/admin/finance/export?report=audit&format=csv&${qs({ action: actionFilter, actor: actorInput, target: targetFilter })}`}>CSV</a>
              <a className="underline" target="_blank" rel="noopener" href={`/api/admin/finance/export?report=audit&format=pdf&${qs({ action: actionFilter, actor: actorInput, target: targetFilter })}`}>PDF</a>
            </span>
          )}
        >
          {audit.length === 0 ? <p className="text-sm text-[#a39a86]">No audit entries match these filters.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[#a39a86]">
                  <tr><th className="py-2">Time (UTC)</th><th>Action</th><th>Actor</th><th>Target</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {audit.map((r) => (
                    <tr key={r.id} className="border-t border-[#2a2116] align-top">
                      <td className="py-1 whitespace-nowrap">{r.createdAt.toISOString().replace('T', ' ').slice(0, 19)}</td>
                      <td className="font-mono">{r.action}</td>
                      <td className="break-all">{r.actor}</td>
                      <td className="break-all font-mono">{r.targetId ?? ''}</td>
                      <td className="break-all">{r.meta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {canLedger && (
        <Section
          title="Transaction history"
          subtitle={`Ledger postings, newest first, up to ${MAX_ROWS} transactions. Ledger postings have no status: each one is final and reversals appear as their own transactions.`}
          action={range && (
            <span className="flex gap-3 text-sm">
              <a className="underline" href={`/api/admin/finance/export?report=transactions&format=csv&${qs({ user: userInput, txId, reference, type })}`}>CSV</a>
              <a className="underline" target="_blank" rel="noopener" href={`/api/admin/finance/export?report=transactions&format=pdf&${qs({ user: userInput, txId, reference, type })}`}>PDF</a>
            </span>
          )}
        >
          {ledger.length === 0 ? <p className="text-sm text-[#a39a86]">No transactions match these filters.</p> : (
            <div className="space-y-4">
              {ledger.map((t) => (
                <div key={t.id} className="rounded-lg border border-[#2a2116] p-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold">{t.type} · {t.description}</span>
                    <span className="text-[#a39a86]">{t.createdAt.toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                  </div>
                  <div className="mt-1 break-all font-mono text-[#a39a86]">{t.id} · ref {t.reference}</div>
                  <table className="mt-2 w-full">
                    <tbody>
                      {t.legs.map((leg, i) => (
                        <tr key={i} className="border-t border-[#2a2116]">
                          <td className="py-1 font-mono break-all">{leg.account}</td>
                          <td>{leg.direction}</td>
                          <td className="text-right">{formatMoney(leg.amountMinor, leg.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
