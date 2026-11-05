import { handle, json, readJson, errors } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { saveDetailsStep, saveFinancialStep, savePersonalStep } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

const steps = {
  personal: savePersonalStep,
  details: saveDetailsStep,
  financial: saveFinancialStep,
} as const;

/** Saves one wizard step. Each step is validated on the server, so drafts stay consistent. */
export const PATCH = handle<{ params: { id: string; step: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const save = steps[params.step as keyof typeof steps];
  if (!save) throw errors.notFound('Step');
  const body = await readJson(req);
  return json(await save(user.id, params.id, body));
});
