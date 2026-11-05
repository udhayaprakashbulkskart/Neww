import { loadWizardCampaign } from '@/lib/services/wizard-page';
import { WizardShell } from '@/components/wizard/wizard-shell';
import { DocumentsStep, type DocRow } from '@/components/wizard/documents';

export const metadata = { title: 'Documents' };

export default async function DocumentsPage({ params }: { params: { id: string } }) {
  const { campaign, editable } = await loadWizardCampaign(params.id);
  const docs: DocRow[] = campaign.documents.map((d) => ({
    id: d.id,
    kind: d.kind,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    reviewStatus: d.reviewStatus,
    reviewNote: d.reviewNote,
  }));
  return (
    <WizardShell campaignId={campaign.id} step="documents" title="Upload documents" subtitle="ID, address proof and at least one bill or loan statement are required. Photos and video are optional.">
      <DocumentsStep campaignId={campaign.id} docs={docs} editable={editable} />
    </WizardShell>
  );
}
