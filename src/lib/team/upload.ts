import { ApiError, errors, parseBody } from '../http';
import { messageSchema } from './schemas';
import { TEAM_MAX_UPLOAD_BYTES } from './schemas';

/** Reject oversized multipart bodies before parsing them. */
function assertBodySize(req: Request) {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > TEAM_MAX_UPLOAD_BYTES + 64 * 1024) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `Files must be ${TEAM_MAX_UPLOAD_BYTES / (1024 * 1024)} MB or smaller.`);
  }
}

export async function readFormFile(req: Request, field = 'file'): Promise<{ bytes: Buffer; fileName: string }> {
  assertBodySize(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw errors.badRequest('Upload could not be read. Choose a file and try again.');
  }
  const file = form.get(field);
  if (!(file instanceof File)) throw errors.badRequest('Choose a file to upload.');
  if (file.size > TEAM_MAX_UPLOAD_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `Files must be ${TEAM_MAX_UPLOAD_BYTES / (1024 * 1024)} MB or smaller.`);
  }
  return { bytes: Buffer.from(await file.arrayBuffer()), fileName: file.name || 'file' };
}

export async function readFormFields(req: Request): Promise<FormData> {
  assertBodySize(req);
  try {
    return await req.formData();
  } catch {
    throw errors.badRequest('Upload could not be read.');
  }
}

/** Chat input: either JSON `{ body }` or multipart with optional `body` text and a `file`. */
export async function readMessageInput(req: Request): Promise<{ body: string | null; file: { bytes: Buffer; fileName: string } | null }> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('multipart/form-data')) {
    const form = await readFormFields(req);
    const rawBody = form.get('body');
    const body = typeof rawBody === 'string' && rawBody.trim() ? rawBody : null;
    const file = form.get('file');
    if (file instanceof File && file.size > 0) {
      if (file.size > TEAM_MAX_UPLOAD_BYTES) {
        throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `Files must be ${TEAM_MAX_UPLOAD_BYTES / (1024 * 1024)} MB or smaller.`);
      }
      return { body, file: { bytes: Buffer.from(await file.arrayBuffer()), fileName: file.name || 'file' } };
    }
    return { body, file: null };
  }
  const parsed = await parseBody(req, messageSchema, 16 * 1024);
  return { body: parsed.body, file: null };
}
