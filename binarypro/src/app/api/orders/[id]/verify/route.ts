import { requirePermission, handle, ok, assertSameOrigin } from '@/lib/server/http';
import { verifyOrder } from '@/lib/server/orders';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requirePermission('orders:transition');
    return ok(await verifyOrder(params.id, user.id));
  });
}
