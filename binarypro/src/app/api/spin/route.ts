import { requireUser, handle, ok, fail, assertSameOrigin } from '@/lib/server/http';
import { getSpinState, spin } from '@/lib/server/spin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await getSpinState(user.id));
  });
}

// POST /api/spin with header "Idempotency-Key": a unique key per attempt. Repeating a key returns the original result.
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser();
    const key = req.headers.get('idempotency-key') ?? '';
    if (!key) return fail('BAD_KEY', 'Missing Idempotency-Key header', 400);
    const result = await spin(user.id, key);
    return ok(result, result.replayed ? 200 : 201);
  });
}
