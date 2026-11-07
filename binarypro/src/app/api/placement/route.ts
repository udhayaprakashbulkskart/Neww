import { z } from 'zod';
import { db } from '@/lib/server/db';
import { handle, ok, readJson, requireUser } from '@/lib/server/http';
import { placeMember } from '@/lib/server/binary';

export const runtime = 'nodejs';
const Body = z.object({ parentId: z.string().min(1).max(64), side: z.enum(['LEFT', 'RIGHT']) });

/** The signed-in member places themselves under their sponsor's downline (user-selected position). */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(req, Body);
    await db.$transaction((tx) => placeMember(tx, user.id, body.parentId, body.side, user.id));
    return ok({ placed: true, parentId: body.parentId, side: body.side });
  });
}
