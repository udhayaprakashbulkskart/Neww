import { db } from '@/lib/db';
import { loadWizardCampaign } from '@/lib/services/wizard-page';
import { WizardShell } from '@/components/wizard/wizard-shell';
import { DetailsForm } from '@/components/wizard/forms';
import { Notice } from '@/components/ui/primitives';

export const metadata = { title: 'Campaign details' };

export default async function DetailsStep({ params }: { params: { id: string } }) {
  const { campaign, editable } = await loadWizardCampaign(params.id);
  const categories = await db.campaignCategory.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { slug: true, name: true } });
  return (
    <WizardShell campaignId={campaign.id} step="details" title="Tell your story" subtitle="Be clear and honest. A specific, truthful story is the fastest way to be verified.">
      {!editable && <Notice tone="info">This campaign is locked while it is being reviewed.</Notice>}
      <DetailsForm
        campaignId={campaign.id}
        initial={{ title: campaign.title, categorySlug: campaign.category.slug, story: campaign.story, urgency: campaign.urgency }}
        categories={categories}
      />
    </WizardShell>
  );
}
