import { startAdView } from '@/lib/server/ads';
import { handle, ok, requireUser, assertSameOrigin } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser();
    return ok(await startAdView(user.id, params.id), 201);
  });
}
