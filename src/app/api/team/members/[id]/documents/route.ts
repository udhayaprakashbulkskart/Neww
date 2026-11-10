import { clientIp, errors, handle, json } from '@/lib/http';
import { kycLabelSchema } from '@/lib/team/schemas';
import { listKycDocuments, uploadKycDocument } from '@/lib/team/members';
import { readFormFields, readFormFile } from '@/lib/team/upload';
import { requireActor, requireAdmin } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

/** KYC documents: the member themself and administrators only. */
export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const actor = await requireActor();
  return json({ documents: await listKycDocuments(actor, params.id) });
});

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const actor = await requireActor();
  requireAdmin(actor);
  const form = await readFormFields(req);
  const label = kycLabelSchema.safeParse(form.get('label'));
  if (!label.success) throw errors.badRequest('Choose the document type.');
  const file = form.get('file');
  if (!(file instanceof File)) throw errors.badRequest('Choose a file to upload.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const doc = await uploadKycDocument(actor, params.id, label.data, bytes, file.name || 'document', clientIp(req));
  return json(doc, { status: 201 });
});
