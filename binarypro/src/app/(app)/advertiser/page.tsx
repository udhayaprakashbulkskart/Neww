import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { listOwnCampaigns, summarise } from '@/lib/server/advertiser';
import { formatMoney, BASE_CURRENCY } from '@/lib/domain/money';
import { CreateCampaignForm, TopUpButton } from '@/components/advertiser';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_REVIEW: { label: 'In review', cls: 'bg-[#d4af37]/15 text-[#f7e09a]' },
  ACTIVE: { label: 'Live', cls: 'bg-emerald-500/15 text-emerald-300' },
  PAUSED: { label: 'Paused', cls: 'bg-white/10 text-[#cfc6b0]' },
  ENDED: { label: 'Ended', cls: 'bg-red-500/10 text-red-300' },
};

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[linear-gradient(160deg,#141008,#070707)] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-[#8f8672]">{hint}</div>}
    </div>
  );
}

export default async function AdvertiserConsole() {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADVERTISER') redirect('/dashboard');

  const campaigns = await listOwnCampaigns(user.id);
  const s = summarise(campaigns);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#f7e09a]">Advertiser console</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Campaigns and performance</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#8f8672]">Every reward is paid from your campaign budget, and only for views that were watched in full.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Live campaigns" value={s.active} hint={`${s.pending} in review`} />
        <Kpi label="Budget remaining" value={formatMoney(s.budget, BASE_CURRENCY)} hint="In INR at today’s rates" />
        <Kpi label="Verified views" value={s.views.toLocaleString('en-IN')} hint={`${s.completionRate}% of started views completed`} />
        <Kpi label="Rewards paid" value={formatMoney(s.spent, BASE_CURRENCY)} hint="Spent from your budgets" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4">
          <h2 className="text-lg font-bold">Your campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-[#8f8672]">No campaigns yet. Create one to start reaching members.</div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const st = STATUS[c.status] ?? STATUS.PENDING_REVIEW;
                return (
                  <article key={c.id} className="rounded-3xl border border-white/5 bg-white/[0.03] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-bold">{c.title}</h3>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                        </div>
                        <div className="mt-1 text-xs text-[#8f8672]">{c.durationSec}s · {formatMoney(c.rewardMinor, c.currency)} per view</div>
                      </div>
                      <TopUpButton campaignId={c.id} currency={c.currency} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <div><dt className="text-xs text-[#8f8672]">Budget left</dt><dd className="font-bold">{formatMoney(c.budgetMinor, c.currency)}</dd></div>
                      <div><dt className="text-xs text-[#8f8672]">Spent</dt><dd className="font-bold">{formatMoney(c.spentMinor, c.currency)}</dd></div>
                      <div><dt className="text-xs text-[#8f8672]">Verified views</dt><dd className="font-bold">{c.verifiedViews}</dd></div>
                      <div><dt className="text-xs text-[#8f8672]">Unique viewers</dt><dd className="font-bold">{c.uniqueViewers}</dd></div>
                    </dl>
                    <div className="mt-4 flex items-center gap-3 text-xs text-[#8f8672]">
                      <span className="w-28 shrink-0">Completion {c.completionRate}%</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" style={{ width: `${c.completionRate}%` }} /></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-[#d4af37]/25 bg-[linear-gradient(160deg,#1d1606,#070707)] p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black"><Icon name="play" className="h-4 w-4" /></span>
              <div>
                <h2 className="font-bold">New campaign</h2>
                <p className="text-xs text-[#8f8672]">Reviewed by staff before it goes live.</p>
              </div>
            </div>
            <CreateCampaignForm />
          </section>
          <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 text-xs leading-relaxed text-[#8f8672]">
            <h2 className="mb-2 text-sm font-bold text-[#cfc6b0]">Ad policy</h2>
            <ul className="list-disc space-y-1.5 pl-4">
              <li>Videos must be hosted on https and use MP4 or WebM.</li>
              <li>Content must be lawful and not misleading. No income or guaranteed-return claims.</li>
              <li>Members are paid only for views watched in full. Skipped views are not billed.</li>
              <li>Unspent budget stays in your campaign until you end it.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
