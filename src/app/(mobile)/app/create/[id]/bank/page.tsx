import { loadWizardCampaign } from '@/lib/services/wizard-page';
import { verificationSummary } from '@/lib/services/verification';
import { WizardShell } from '@/components/wizard/wizard-shell';
import { BankForm } from '@/components/wizard/forms';

export const metadata = { title: 'Bank account' };

export default async function BankStep({ params }: { params: { id: string } }) {
  const { campaign, user } = await loadWizardCampaign(params.id);
  const summary = await verificationSummary(user.id);
  const primary = summary.banks.find((b) => b.isPrimary);
  return (
    <WizardShell campaignId={campaign.id} step="bank" title="Payout account" subtitle="Donations are paid to this account after verification. It must be in your name.">
      <BankForm
        campaignId={campaign.id}
        existing={
          primary
            ? { holder: primary.accountHolderName, account: `XXXXXX${primary.accountLast4}`, ifsc: primary.ifscCode, bank: primary.bankName, status: primary.status }
            : null
        }
      />
    </WizardShell>
  );
}
