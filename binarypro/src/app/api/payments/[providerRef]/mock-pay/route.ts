import { handle, ok, requireUser, assertSameOrigin } from '@/lib/server/http';
import { simulateMockCapture } from '@/lib/server/payments';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { providerRef: string } }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser();
    return ok(await simulateMockCapture(params.providerRef, user.id));
  });
}
