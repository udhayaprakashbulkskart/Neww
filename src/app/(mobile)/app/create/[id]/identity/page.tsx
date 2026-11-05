import { loadWizardCampaign, verificationFor } from '@/lib/services/wizard-page';
import { WizardShell } from '@/components/wizard/wizard-shell';
import { VerifyStep } from '@/components/wizard/verify-step';

export const metadata = { title: 'Identity verification' };

export default async function IdentityStep({ params }: { params: { id: string } }) {
  const { campaign, user } = await loadWizardCampaign(params.id);
  const { status } = await verificationFor(user.id, 'IDENTITY');
  return (
    <WizardShell campaignId={campaign.id} step="identity" title="Verify your identity" subtitle="We confirm your identity with an authorised partner, using your consent. The check does not expose your ID number to donors.">
      <VerifyStep
        campaignId={campaign.id}
        step="identity"
        status={status}
        endpoint="/api/verifications/identity"
        title="Identity check"
        body="Confirms that the name on your ID matches the person requesting help."
        consentRequired
      />
    </WizardShell>
  );
}
