import { z } from 'zod';
import { handle, json, readJson, clientIp, errors } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { simulateMockPayment } from '@/lib/services/payment-events';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const schema = z.object({ outcome: z.enum(['success', 'failed']) });

/**
 * Sandbox-only payment simulator for development and QA. Returns 404 in production and whenever a
 * real gateway is configured. It runs the same signature and webhook code as live payments.
 */
export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  if (env().isProduction) throw errors.notFound('Route');
  const user = await requireUser();
  const body = schema.parse(await readJson(req));
  const result = await simulateMockPayment({ donorId: user.id, donationId: params.id, outcome: body.outcome, ip: clientIp(req) });
  return json(result);
});
