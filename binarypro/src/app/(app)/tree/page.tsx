import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { binaryDownline } from '@/lib/server/binary';
import { buildTree, type TreeNode } from '@/lib/server/tree';
import { PlacementForm } from '@/components/client';
import { TreeView } from '@/components/tree-view';
import { Notice, Money } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function TreePage({ searchParams }: { searchParams: { root?: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const requested = typeof searchParams.root === 'string' && /^[a-z0-9]{10,64}$/i.test(searchParams.root) ? searchParams.root : user.id;

  let root: TreeNode | null = null;
  let error: string | null = null;
  try {
    root = await buildTree(user.id, requested, 4);
  } catch {
    error = 'That member is outside your binary downline.';
  }

  let options: { id: string; name: string; freeSides: ('LEFT' | 'RIGHT')[] }[] = [];
  if (!user.parentId && user.sponsorId) {
    const downline = [...(await binaryDownline(db, user.sponsorId))];
    const kids = await db.user.findMany({ where: { parentId: { in: downline } }, select: { parentId: true, side: true } });
    const taken = new Set(kids.map((k) => `${k.parentId}:${k.side}`));
    const people = await db.user.findMany({ where: { id: { in: downline } }, select: { id: true, name: true }, take: 500 });
    options = people
      .map((p) => ({ id: p.id, name: p.name, freeSides: (['LEFT', 'RIGHT'] as const).filter((s) => !taken.has(`${p.id}:${s}`)) as ('LEFT' | 'RIGHT')[] }))
      .filter((o) => o.freeSides.length > 0)
      .slice(0, 50);
  }

  // Summary for the member in focus: team sizes and unmatched volume on each leg.
  let summary: null | { name: string; tier: string | null; active: boolean; left: number; right: number; legLeft: bigint; legRight: bigint; isMe: boolean; focusId: string } = null;
  if (root) {
    const [leftSize, rightSize, legs] = await Promise.all([
      root.left ? binaryDownline(db, root.left.id).then((s) => s.size) : Promise.resolve(0),
      root.right ? binaryDownline(db, root.right.id).then((s) => s.size) : Promise.resolve(0),
      db.pvLeg.findMany({ where: { userId: root.id } }),
    ]);
    summary = {
      name: root.name,
      tier: root.tier,
      active: root.active,
      left: leftSize,
      right: rightSize,
      legLeft: legs.find((l) => l.side === 'LEFT')?.pvMinor ?? 0n,
      legRight: legs.find((l) => l.side === 'RIGHT')?.pvMinor ?? 0n,
      isMe: root.id === user.id,
      focusId: root.id,
    };
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Binary tree</h1>
          <p className="mt-1 text-sm text-[#8f8672]">Tap any member to focus their team. Two levels are shown at a time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#8f8672]">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Active plan</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-600" />Inactive</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-md border border-[#d4af37]" />You</span>
        </div>
      </header>

      {summary && (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="col-span-2 rounded-2xl border border-white/5 bg-white/[0.03] p-5 xl:col-span-1">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">{summary.isMe ? 'Your position' : 'Team in focus'}</div>
            <div className="mt-2 text-xl font-extrabold">{summary.name}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#8f8672]">
              <span className={`h-1.5 w-1.5 rounded-full ${summary.active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              {summary.tier ?? 'No plan'}
              {!summary.isMe && <a href="/tree" className="ml-auto font-semibold text-[#f7e09a]">Back to my tree</a>}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">Left team</div>
            <div className="mt-2 text-2xl font-extrabold">{summary.left.toLocaleString('en-IN')}</div>
            <div className="mt-1 text-xs text-[#8f8672]">unmatched <Money minor={summary.legLeft} /></div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">Right team</div>
            <div className="mt-2 text-2xl font-extrabold">{summary.right.toLocaleString('en-IN')}</div>
            <div className="mt-1 text-xs text-[#8f8672]">unmatched <Money minor={summary.legRight} /></div>
          </div>
        </section>
      )}
      {!user.parentId && (
        <section className="rounded-3xl border border-[#d4af37]/30 bg-[linear-gradient(160deg,#1d1606,#080808)] p-6">
          <h2 className="font-bold">Choose your position</h2>
          <p className="mb-4 text-sm text-[#8f8672]">Place yourself inside your sponsor&apos;s team. Each slot holds one member.</p>
          {!user.sponsorId ? (
            <Notice tone="warn">You have no sponsor, so you cannot be placed in a team yet. Ask your sponsor for their invite link.</Notice>
          ) : options.length === 0 ? (
            <Notice tone="warn">No open positions are available in your sponsor&apos;s team right now.</Notice>
          ) : (
            <PlacementForm options={options} />
          )}
        </section>
      )}
      <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 md:p-6">
        {error && <Notice tone="warn">{error}</Notice>}
        {root ? <TreeView root={root} viewerId={user.id} /> : !error && <p className="text-sm text-[#8f8672]">You are not placed in the tree yet.</p>}
      </section>
    </div>
  );
}
