import { completeAdView } from '@/lib/server/ads';
import { handle, ok, requireUser, assertSameOrigin } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { viewId: string } }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser();
    return ok(await completeAdView(user.id, params.viewId));
  });
}
