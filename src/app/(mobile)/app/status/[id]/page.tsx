import { redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/session';
import { getOwnedCampaign } from '@/lib/services/campaigns';

/** Routes to the right status screen for the campaign's current state. */
export default async function StatusRouter({ params }: { params: { id: string } }) {
  const user = await requirePageUser(`/app/status/${params.id}`);
  const c = await getOwnedCampaign(user.id, params.id).catch(() => null);
  if (!c) redirect('/app/create');
  if (['APPROVED', 'PUBLISHED', 'CLOSED'].includes(c.status)) redirect(`/app/status/${params.id}/approved`);
  redirect(`/app/status/${params.id}/pending`);
}
