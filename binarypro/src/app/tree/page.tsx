import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { binaryDownline } from '@/lib/server/binary';
import { buildTree, type TreeNode } from '@/lib/server/tree';
import { PlacementForm } from '@/components/client';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

function NodeView({ node, viewerId }: { node: TreeNode | null; viewerId: string }) {
  if (!node) {
    return <div className="grid h-16 w-full place-items-center rounded-xl border border-dashed border-[#2a2116] text-xs text-[#6f6758]">Open slot</div>;
  }
  const isMe = node.id === viewerId;
  return (
    <div className="flex flex-col items-center gap-3">
      <Link
        href={isMe ? '/tree' : `/tree?root=${node.id}`}
        className={`w-36 rounded-xl border p-3 text-center transition hover:-translate-y-0.5 ${isMe ? 'border-[#d4af37] bg-[#1a1407]' : 'border-[#2a2116] bg-[#0b0b0b]'}`}
      >
        <div className="truncate text-sm font-bold">{node.name}</div>
        <div className="mt-1 flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-[#a39a86]">
          <span className={`inline-block h-2 w-2 rounded-full ${node.active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          {node.tier ?? 'No plan'}
        </div>
        {node.side && <div className="mt-1 text-[10px] text-[#6f6758]">{node.side}</div>}
      </Link>
      <div className="flex gap-4 border-t border-[#2a2116] pt-4">
        <div className="flex flex-col items-center"><NodeView node={node.left} viewerId={viewerId} /></div>
        <div className="flex flex-col items-center"><NodeView node={node.right} viewerId={viewerId} /></div>
      </div>
    </div>
  );
}

export default async function TreePage({ searchParams }: { searchParams: { root?: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const requested = typeof searchParams.root === 'string' && /^[a-z0-9]{10,64}$/i.test(searchParams.root) ? searchParams.root : user.id;

  let root: TreeNode | null = null;
  let error: string | null = null;
  try {
    root = await buildTree(user.id, requested, 4);
  } catch {
    error = 'That node is outside your binary downline.';
  }

  // Placement options: nodes in the sponsor's downline that still have an open slot.
  let options: { id: string; name: string; freeSides: ('LEFT' | 'RIGHT')[] }[] = [];
  if (!user.parentId && user.sponsorId) {
    const downline = [...(await binaryDownline(db, user.sponsorId))];
    const kids = await db.user.findMany({ where: { parentId: { in: downline } }, select: { parentId: true, side: true } });
    const taken = new Set(kids.map((k) => `${k.parentId}:${k.side}`));
    const people = await db.user.findMany({ where: { id: { in: downline } }, select: { id: true, name: true }, take: 500 });
    options = people
      .map((p) => {
        const freeSides = (['LEFT', 'RIGHT'] as const).filter((s) => !taken.has(`${p.id}:${s}`));
        return { id: p.id, name: p.name, freeSides: [...freeSides] };
      })
      .filter((o) => o.freeSides.length > 0)
      .slice(0, 50);
  }

  return (
    <div className="space-y-6">
      {!user.parentId && (
        <Section title="Place yourself in the binary tree" subtitle="Choose a position inside your sponsor's team. Each slot holds one member.">
          {!user.sponsorId ? (
            <Notice tone="warn">You have no sponsor, so you cannot be placed in a team. Ask your sponsor for their referral link.</Notice>
          ) : options.length === 0 ? (
            <Notice tone="warn">No open positions are available in your sponsor&apos;s team right now.</Notice>
          ) : (
            <PlacementForm options={options} />
          )}
        </Section>
      )}
      <Section title="Binary tree" subtitle="Tap a member to view their team. Green dot means an active membership.">
        {error && <Notice tone="warn">{error}</Notice>}
        {root && (
          <div className="overflow-x-auto pb-4">
            <div className="mx-auto w-max"><NodeView node={root} viewerId={user.id} /></div>
          </div>
        )}
        {!root && !error && <p className="text-sm text-[#a39a86]">You are not placed in the tree yet.</p>}
      </Section>
    </div>
  );
}
