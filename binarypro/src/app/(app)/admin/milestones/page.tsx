import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { formatMoney } from '@/lib/domain/money';
import { activeRule, listPrizes } from '@/lib/server/milestones';
import { RuleEditor, EvaluateButton, PrizeEditor, AwardActions } from '@/components/admin/milestone-admin';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

const dateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

export default async function MilestonesPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const role = user.role as StaffRole;
  const canManage = can(role, 'milestones:manage');
  const canDecide = can(role, 'milestones:decide');
  if (!canManage && !canDecide) redirect('/dashboard');

  const [rule, prizes, awards] = await Promise.all([
    activeRule(),
    listPrizes(),
    db.milestoneAward.findMany({
      orderBy: [{ status: 'asc' }, { qualifiedAt: 'desc' }],
      take: 200,
      include: { user: { select: { name: true, email: true } }, prize: { select: { name: true, model: true } }, rule: { select: { name: true, thresholdMinor: true } } },
    }),
  ]);
  const prizeOptions = prizes.filter((p) => p.active).map((p) => ({ id: p.id, label: `${p.name}: ${p.model}` }));
  const counts = awards.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Retail milestones</h1>
          <p className="text-sm text-[#a39a86]">Eligibility counts a member&apos;s own verified retail sales only. Team volume and recruitment never count. Prizes are goods, not cash.</p>
        </div>
        <Link href="/admin" className="text-sm underline">Back to admin</Link>
      </div>

      {canManage && (
        <Section title="Milestone rule" subtitle="One rule is in force at a time. Changes apply to future checks; awards already made are kept.">
          {rule ? (
            <RuleEditor rule={{
              id: rule.id,
              name: rule.name,
              thresholdRupees: (Number(rule.thresholdMinor) / 100).toFixed(2),
              startsAt: dateInput(rule.startsAt),
              endsAt: dateInput(rule.endsAt),
              active: rule.active,
            }} />
          ) : (
            <Notice tone="warn">No active rule. Members cannot qualify until one is active.</Notice>
          )}
        </Section>
      )}

      <Section
        title="Awards queue"
        subtitle={`Qualified members wait here for a decision. Showing up to 200. Qualified ${counts.QUALIFIED ?? 0} · Approved ${counts.APPROVED ?? 0} · Fulfilled ${counts.FULFILLED ?? 0} · Rejected ${counts.REJECTED ?? 0}`}
        action={canManage ? <EvaluateButton /> : undefined}
      >
        {awards.length === 0 ? <p className="text-sm text-[#a39a86]">No awards yet.{canManage ? ' Use “Check for new qualifiers” after verified sales are in.' : ''}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[#a39a86]">
                <tr><th className="py-2">Member</th><th>Milestone</th><th>Personal verified sales</th><th>Qualified</th><th>Status</th><th>Prize</th><th>Action</th></tr>
              </thead>
              <tbody>
                {awards.map((a) => (
                  <tr key={a.id} className="border-t border-[#2a2116] align-top">
                    <td className="py-2 break-all">{a.user.email ?? a.user.name}</td>
                    <td>{a.rule.name}</td>
                    <td>{formatMoney(a.metricMinor, 'INR')}</td>
                    <td className="whitespace-nowrap">{a.qualifiedAt.toISOString().slice(0, 10)}</td>
                    <td>{a.status}{a.decisionNote ? <div className="text-[#8f8672]">{a.decisionNote}</div> : null}</td>
                    <td>{a.prize ? `${a.prize.name}: ${a.prize.model}` : '-'}</td>
                    <td>{canDecide ? <AwardActions awardId={a.id} status={a.status} prizes={prizeOptions} /> : <span className="text-[#8f8672]">View only</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {canManage && (
        <Section title="Prizes" subtitle="Hidden prizes cannot be chosen for new awards and are not shown on member dashboards.">
          <div className="space-y-3">
            {prizes.map((p) => (
              <PrizeEditor key={p.id} prize={{ ...p, details: p.details }} />
            ))}
            <details className="rounded-xl border border-dashed border-white/10 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Add a prize</summary>
              <div className="mt-3"><PrizeEditor /></div>
            </details>
          </div>
        </Section>
      )}
    </div>
  );
}
