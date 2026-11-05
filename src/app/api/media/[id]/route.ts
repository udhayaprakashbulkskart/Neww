import { handle } from '@/lib/http';
import { readPublicMedia } from '@/lib/services/documents';

export const dynamic = 'force-dynamic';

/** Public campaign photos and videos. Only approved media on live campaigns can be fetched. */
export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const { bytes, mimeType } = await readPublicMedia(params.id);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});
