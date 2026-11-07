import { db } from '@/lib/server/db';
import { handle, ok } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET() {
  return handle(async () => {
    const products = await db.product.findMany({
      where: { active: true, merchant: { active: true } },
      include: { merchant: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
      take: 200,
    });
    return ok({ products });
  });
}
