import { z } from 'zod';
import { requestOtp } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
const Body = z.object({ phone: z.string().min(8).max(20) });

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, Body);
    await requestOtp(body.phone);
    return ok({ sent: true });
  });
}
