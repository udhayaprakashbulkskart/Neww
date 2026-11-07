import { z } from 'zod';
import { db } from '@/lib/server/db';
import { createOrder } from '@/lib/server/orders';
import { handle, ok, readJson, requireUser } from '@/lib/server/http';

export const runtime = 'nodejs';
const Body = z.object({
  items: z.array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(99) })).min(1).max(50),
  couponCode: z.string().trim().max(40).optional().nullable(),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const orders = await db.order.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: { include: { product: { select: { name: true } } } }, merchant: { select: { name: true } } },
    });
    return ok({ orders });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(req, Body);
    const order = await createOrder(user.id, body.items, body.couponCode ?? null);
    return ok({ order, paymentRef: `ord_${order.id}` }, 201);
  });
}
