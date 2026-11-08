import { requirePermission, handle } from '@/lib/server/http';
import { openKycDocument } from '@/lib/server/kyc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('kyc:review');
    const doc = await openKycDocument(params.id, user.id);
    return new Response(new Uint8Array(doc.bytes), {
      headers: {
        'Content-Type': doc.mime,
        'Content-Disposition': `inline; filename="${doc.kind.toLowerCase()}-document"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
