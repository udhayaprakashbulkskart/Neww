import { requireUser, handle, ok, assertSameOrigin } from '@/lib/server/http';
import { claimReward } from '@/lib/server/spin';

export const runtime = 'nodejs';

// POST /api/spin/claims/{spinId}/claim: claims a held reward. Needs an active paid membership at this moment.
export async function POST(req: Request, { params }: { params: { spinId: string } }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser();
    return ok(await claimReward(user.id, params.spinId));
  });
}
