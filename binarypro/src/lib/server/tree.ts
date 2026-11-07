// Binary tree view model. Only nodes inside the viewer's own binary downline are returned.
import { db } from './db';
import { binaryDownline } from './binary';
import { DomainError } from './errors';

export interface TreeNode {
  id: string;
  name: string;
  tier: string | null;
  active: boolean;
  side: 'LEFT' | 'RIGHT' | null;
  left: TreeNode | null;
  right: TreeNode | null;
}

export async function buildTree(viewerId: string, rootId: string, depth: number): Promise<TreeNode | null> {
  const d = Math.min(Math.max(depth, 1), 6);
  const allowed = await binaryDownline(db, viewerId);
  if (!allowed.has(rootId)) throw new DomainError('FORBIDDEN', 'That node is outside your binary downline', 403);

  const load = async (id: string, level: number): Promise<TreeNode | null> => {
    if (level > d) return null;
    const u = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, side: true, membership: { select: { tier: true, active: true, expiresAt: true } } },
    });
    if (!u) return null;
    const kids = await db.user.findMany({ where: { parentId: id }, select: { id: true, side: true } });
    const leftKid = kids.find((k) => k.side === 'LEFT');
    const rightKid = kids.find((k) => k.side === 'RIGHT');
    return {
      id: u.id,
      name: u.name,
      tier: u.membership?.tier ?? null,
      active: !!u.membership?.active && (u.membership?.expiresAt.getTime() ?? 0) > Date.now(),
      side: u.side,
      left: leftKid ? await load(leftKid.id, level + 1) : null,
      right: rightKid ? await load(rightKid.id, level + 1) : null,
    };
  };
  return load(rootId, 1);
}
