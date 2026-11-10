import { clientIp, handle, json } from '@/lib/http';
import { readFileForActor } from '@/lib/team/files';
import { removeFile } from '@/lib/team/members';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

/**
 * Authenticated file access. Photos and images are shown inline; everything else is an attachment.
 * The response is private, never cached publicly, and sandboxed against script execution.
 */
export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const actor = await requireActor();
  const file = await readFileForActor(actor, params.id);
  const disposition = file.isImage ? 'inline' : 'attachment';
  const safeName = file.name.replace(/"/g, '');
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': `${disposition}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
    },
  });
});

export const DELETE = handle<{ params: { id: string } }>(async (req, { params }) => {
  const actor = await requireActor();
  await removeFile(actor, params.id, clientIp(req));
  return json({ deleted: true });
});
