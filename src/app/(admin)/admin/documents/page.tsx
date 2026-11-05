import Link from 'next/link';
import { documentsNeedingReview } from '@/lib/services/documents';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, formatCell } from '@/components/admin/shell';
import { DocumentReviewActions } from '@/components/admin/actions';
import { formatDate } from '@/lib/format';
import { signedDocumentPath } from '@/lib/services/documents';

export const metadata = { title: 'Document review' };

export default async function DocumentsQueue() {
  const { user, perms } = await adminContext(PERMISSIONS.DOCUMENT_REVIEW);
  const docs = await documentsNeedingReview(100);

  return (
    <AdminFrame permissions={perms} active="/admin/documents" name={user.fullName}>
      <PageTitle title="Document review" description="Uploaded documents waiting for a decision. Files open through short-lived links, and every view is logged." />
      <Table head={['Document', 'Campaign', 'Uploaded', 'File', 'Decision']} empty="No documents waiting for review.">
        {docs.map((d) => (
          <tr key={d.id} className="align-top hover:bg-white/[0.02]">
            <td className="px-5 py-4">
              <p className="font-medium">{formatCell(d.kind)}</p>
              <p className="text-xs text-ui-subtle">{d.mimeType}</p>
            </td>
            <td className="px-5 py-4">
              <Link href={`/admin/campaigns/${d.campaign.id}`} className="hover:text-mint">
                {d.campaign.title}
              </Link>
            </td>
            <td className="px-5 py-4 text-ui-muted">{formatDate(d.createdAt)}</td>
            <td className="px-5 py-4">
              <a href={signedDocumentPath(d.id, 300)} target="_blank" rel="noopener" className="text-xs font-semibold text-mint">
                Open (5 min)
              </a>
            </td>
            <td className="w-72 px-5 py-4">
              <DocumentReviewActions documentId={d.id} />
            </td>
          </tr>
        ))}
      </Table>
      <Badge tone="grey">{docs.length} pending</Badge>
    </AdminFrame>
  );
}
