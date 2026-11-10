import { clientIp, handle, json } from '@/lib/http';
import { readFormFile } from '@/lib/team/upload';
import { setMemberPhoto } from '@/lib/team/members';
import { requireActor, requireAdmin } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const actor = await requireActor();
  requireAdmin(actor);
  const { bytes, fileName } = await readFormFile(req, 'file');
  return json(await setMemberPhoto(actor, params.id, bytes, fileName, clientIp(req)), { status: 201 });
});
