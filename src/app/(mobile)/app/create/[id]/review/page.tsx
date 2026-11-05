import { loadWizardCampaign } from '@/lib/services/wizard-page';
import { submissionChecklist } from '@/lib/services/campaigns';
import { formatINR } from '@/lib/format';
import { WizardShell } from '@/components/wizard/wizard-shell';
import { ReviewSubmit } from '@/components/wizard/review-submit';

export const metadata = { title: 'Review and submit' };

export default async function ReviewStep({ params }: { params: { id: string } }) {
  const { campaign, user, editable } = await loadWizardCampaign(params.id);
  const checklist = await submissionChecklist(user.id, campaign.id);
  return (
    <WizardShell campaignId={campaign.id} step="review" title="Review and submit" subtitle="Check everything once more. You can still edit until you submit.">
      {!editable && <p className="text-sm text-ui-warning">This campaign cannot be submitted in its current state.</p>}
      <ReviewSubmit
        campaignId={campaign.id}
        items={checklist.items}
        complete={checklist.complete && editable}
        summary={{
          title: campaign.title === 'Untitled campaign' ? 'Untitled draft' : campaign.title,
          requested: formatINR(campaign.requestedPaise),
          debt: formatINR(campaign.totalDebtPaise),
          city: [campaign.city, campaign.state].filter(Boolean).join(', '),
        }}
      />
    </WizardShell>
  );
}
