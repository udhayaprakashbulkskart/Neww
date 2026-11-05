import { notFound } from 'next/navigation';
import { getOwnedCampaign } from './campaigns';
import { verificationSummary } from './verification';
import { requirePageUser } from '@/lib/auth/session';
import { EDITABLE_STATUSES } from '@/lib/state/campaign-machine';

/** Loads an owned campaign for a wizard page. Any other user, or a missing campaign, gets a 404. */
export async function loadWizardCampaign(campaignId: string) {
  const user = await requirePageUser(`/app/create/${campaignId}`);
  let campaign;
  try {
    campaign = await getOwnedCampaign(user.id, campaignId);
  } catch {
    notFound();
  }
  return {
    user,
    campaign,
    editable: EDITABLE_STATUSES.includes(campaign.status),
  };
}

export async function verificationFor(userId: string, type: string) {
  const summary = await verificationSummary(userId);
  const item = summary.items.find((i) => i.type === type);
  return { status: item?.status ?? 'PENDING', summary };
}
