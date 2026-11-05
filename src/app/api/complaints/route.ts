import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { createComplaint, listMyComplaints } from '@/lib/services/profile';
import { complaintSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ items: await listMyComplaints(user.id) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = complaintSchema.parse(await readJson(req));
  return json(await createComplaint(user.id, body, clientIp(req)), { status: 201 });
});
