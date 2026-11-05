import { loadWizardCampaign } from '@/lib/services/wizard-page';
import { WizardShell } from '@/components/wizard/wizard-shell';
import { PersonalForm } from '@/components/wizard/forms';
import { Notice } from '@/components/ui/primitives';

export const metadata = { title: 'Personal information' };

export default async function PersonalStep({ params }: { params: { id: string } }) {
  const { campaign, editable } = await loadWizardCampaign(params.id);
  const profile = campaign.beneficiary.profile;
  return (
    <WizardShell campaignId={campaign.id} step="personal" title="About you" subtitle="We use these details to confirm who you are. Your full address is never shown publicly.">
      {!editable && <Notice tone="info">This step is locked while the campaign is being reviewed.</Notice>}
      <PersonalForm
        campaignId={campaign.id}
        initial={{
          fullName: campaign.beneficiary.fullName,
          addressLine: profile?.addressLine ?? '',
          city: profile?.city ?? '',
          state: profile?.state ?? '',
          pincode: profile?.pincode ?? '',
        }}
      />
    </WizardShell>
  );
}
