import { handle, ok, requireUser } from '@/lib/server/http';
import { buildTree } from '@/lib/server/tree';

export const runtime = 'nodejs';

/** Binary tree from the signed-in member's position, to `depth` levels (max 6). Only the member's own downline. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const depth = Math.min(Math.max(Number(url.searchParams.get('depth') ?? 4), 1), 6);
    const rootId = url.searchParams.get('root') ?? user.id;
    return ok({ root: await buildTree(user.id, rootId, depth), depth });
  });
}
