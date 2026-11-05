import { loadWizardCampaign } from '@/lib/services/wizard-page';
import { WizardShell } from '@/components/wizard/wizard-shell';
import { FinancialForm } from '@/components/wizard/forms';
import { Notice } from '@/components/ui/primitives';

export const metadata = { title: 'Financial details' };

export default async function FinancialStep({ params }: { params: { id: string } }) {
  const { campaign, editable } = await loadWizardCampaign(params.id);
  return (
    <WizardShell campaignId={campaign.id} step="financial" title="Money details" subtitle="Be exact. Your bills and loan statements will be checked against these numbers.">
      {!editable && <Notice tone="info">This step is locked while the campaign is being reviewed.</Notice>}
      <FinancialForm
        campaignId={campaign.id}
        initial={{ totalDebtPaise: campaign.totalDebtPaise, paidPaise: campaign.paidPaise, requestedPaise: campaign.requestedPaise }}
      />
    </WizardShell>
  );
}
