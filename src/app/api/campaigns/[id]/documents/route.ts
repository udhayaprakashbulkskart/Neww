import { handle, json, clientIp, errors } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { uploadDocument } from '@/lib/services/documents';
import { env } from '@/lib/env';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const kindSchema = z.enum(['IDENTITY', 'ADDRESS', 'INCOME', 'LOAN_STATEMENT', 'MEDICAL_BILL', 'EDUCATION_FEE', 'BANK_PROOF', 'OTHER', 'PHOTO', 'VIDEO']);

/** Multipart upload: fields `kind` and `file`. The file is validated by its bytes, then encrypted at rest. */
export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const form = await req.formData().catch(() => null);
  if (!form) throw errors.badRequest('Upload a file using the document form.');

  const kind = kindSchema.parse(form.get('kind'));
  const file = form.get('file');
  if (!(file instanceof File)) throw errors.badRequest('Choose a file to upload.');

  // Hard ceiling before reading into memory: the largest allowed type is a 25 MB video.
  const ceiling = Math.max(env().MAX_UPLOAD_MB, 25) * 1024 * 1024;
  if (file.size === 0) throw errors.badRequest('The file is empty.');
  if (file.size > ceiling) throw errors.badRequest('File is too large.');

  const bytes = Buffer.from(await file.arrayBuffer());
  const doc = await uploadDocument({
    userId: user.id,
    campaignId: params.id,
    kind,
    fileName: file.name,
    declaredType: file.type,
    bytes,
    ip: clientIp(req),
  });
  return json(doc, { status: 201 });
});
