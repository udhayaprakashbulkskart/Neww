import { loadWizardCampaign, verificationFor } from '@/lib/services/wizard-page';
import { WizardShell } from '@/components/wizard/wizard-shell';
import { VerifyStep } from '@/components/wizard/verify-step';

export const metadata = { title: 'Address verification' };

export default async function AddressStep({ params }: { params: { id: string } }) {
  const { campaign, user } = await loadWizardCampaign(params.id);
  const { status } = await verificationFor(user.id, 'ADDRESS');
  const hasAddress = !!campaign.beneficiary.profile?.addressLine && !!campaign.beneficiary.profile?.pincode;
  return (
    <WizardShell campaignId={campaign.id} step="address" title="Verify your address" subtitle="We match the address you entered with your address proof.">
      <VerifyStep
        campaignId={campaign.id}
        step="address"
        status={status}
        endpoint="/api/verifications/address"
        title="Address check"
        body="Matches your address with the proof you uploaded, and confirms the pincode."
        disabledReason={hasAddress ? undefined : 'Add your address in the Personal step first.'}
      />
    </WizardShell>
  );
}
