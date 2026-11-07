import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { binaryDownline } from '@/lib/server/binary';
import { buildTree, type TreeNode } from '@/lib/server/tree';
import { PlacementForm } from '@/components/client';
import { TreeView } from '@/components/tree-view';
import { Notice } from '@/components/ui';

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Binary tree</h1>
        <p className="mt-1 text-sm text-[#8f8672]">Tap any member to focus their team. Green means an active membership.</p>
      </header>
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
