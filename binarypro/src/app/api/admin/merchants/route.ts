import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { audit } from '@/lib/server/audit';
import { CURRENCIES, parseMinor } from '@/lib/domain/money';

export const runtime = 'nodejs';

export async function GET() {
  return handle(async () => {
    await requirePermission('merchants:manage');
    return ok({ merchants: await db.merchant.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) });
  });
}

const Create = z.object({ name: z.string().trim().min(2).max(120) });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('merchants:manage');
    const body = await readJson(req, Create);
    const merchant = await db.$transaction(async (tx) => {
      const m = await tx.merchant.create({ data: { name: body.name } });
      await audit(tx, { action: 'merchant.created', actorId: user.id, targetId: m.id });
      return m;
    });
    return ok(merchant, 201);
  });
}

// Product creation: a single admin route keeps catalogue changes in one audited place.
const Product = z.object({
  merchantId: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.enum(CURRENCIES),
});

export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requirePermission('merchants:manage');
    const body = await readJson(req, Product);
    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: { merchantId: body.merchantId, name: body.name, priceMinor: parseMinor(body.price), currency: body.currency },
      });
      await audit(tx, { action: 'product.created', actorId: user.id, targetId: p.id });
      return p;
    });
    return ok(product, 201);
  });
}
