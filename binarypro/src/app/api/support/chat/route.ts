import { z } from 'zod';
import { handle, ok, readJson } from '@/lib/server/http';
import { answer } from '@/lib/support/bot';
import { DomainError } from '@/lib/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(12).optional(),
});

// Simple per-instance limit: 20 messages a minute per client. Serverless instances each keep their own count.
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n += 1;
  return h.n > 20;
}

export async function POST(req: Request) {
  return handle(async () => {
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    if (limited(ip)) throw new DomainError('RATE_LIMIT', 'You are sending messages too quickly. Please wait a minute.', 429);
    const body = await readJson(req, Body);
    return ok(await answer(body.message, body.history ?? []));
  });
}
