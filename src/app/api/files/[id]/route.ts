import { handle, errors } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth/session';
import { readDocumentForDownload } from '@/lib/services/documents';

export const dynamic = 'force-dynamic';

/**
 * Private document download. Requires a valid, unexpired signed link, or an authenticated owner or
 * reviewer. Responses are never cached and always served as attachments to avoid script execution.
 */
export const GET = handle<{ params: { id: string } }>(async (req, { params }) => {
  const url = new URL(req.url);
  const viewer = await getCurrentUser();
  const { bytes, mimeType, name } = await readDocumentForDownload({
    documentId: params.id,
    exp: url.searchParams.get('exp'),
    sig: url.searchParams.get('sig'),
    viewerId: viewer?.id ?? null,
  });
  if (!bytes) throw errors.notFound('Document');
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});
