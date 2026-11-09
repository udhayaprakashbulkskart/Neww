import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { createService } from '@/lib/server/catalogue';

export const runtime = 'nodejs';
const Body = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(500),
  priceRupees: z.string().trim().min(1).max(20),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'MYR', 'SAR']),
  reason: z.string().trim().min(8).max(300),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('catalogue:manage');
    const body = await readJson(req, Body);
    const s = await createService(body, user.id);
    return ok({ id: s.id }, 201);
  });
}
