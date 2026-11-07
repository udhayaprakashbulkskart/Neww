import { db } from '@/lib/server/db';
import { markDelivered } from '@/lib/server/orders';
import { handle, ok, requireUser, assertSameOrigin } from '@/lib/server/http';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { DomainError } from '@/lib/server/errors';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser();
    const order = await db.order.findUnique({ where: { id: params.id }, include: { merchant: true } });
    if (!order) throw new DomainError('NOT_FOUND', 'Order not found', 404);
    const isAdmin = can(user.role as StaffRole, 'orders:transition');
    const isOwnMerchant = user.role === 'MERCHANT' && !!user.merchantId && user.merchantId === order.merchantId;
    if (!isAdmin && !isOwnMerchant) throw new DomainError('FORBIDDEN', 'Not allowed', 403);
    await markDelivered(order.id, user.id);
    return ok({ delivered: true });
  });
}
