import Link from 'next/link';
import { db } from '@/lib/db';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { VerificationReviewActions } from '@/components/admin/actions';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Verification queue' };

export default async function VerificationQueue() {
  const { user, perms } = await adminContext(PERMISSIONS.VERIFICATION_REVIEW);
  const rows = await db.verification.findMany({
    where: { status: { in: ['PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED'] }, type: { not: 'MOBILE_OTP' } },
    orderBy: { updatedAt: 'asc' },
    take: 100,
    select: {
      id: true,
      type: true,
      status: true,
      providerName: true,
      failureReason: true,
      updatedAt: true,
      user: { select: { id: true, fullName: true, mobileLast4: true } },
    },
  });

  return (
    <AdminFrame permissions={perms} active="/admin/verifications" name={user.fullName}>
      <PageTitle title="Verification queue" description="Identity, address, bank and document checks that need a decision. Oldest first." />
      <Table head={['Beneficiary', 'Check', 'Provider', 'Status', 'Waiting since', 'Decision']} empty="The verification queue is clear.">
        {rows.map((v) => (
          <tr key={v.id} className="align-top hover:bg-white/[0.02]">
            <td className="px-5 py-4">
              <Link href={`/admin/users/${v.user.id}`} className="font-medium hover:text-mint">
                {v.user.fullName}
              </Link>
              <p className="font-mono text-xs text-ui-subtle">••••••{v.user.mobileLast4}</p>
            </td>
            <td className="px-5 py-4">{formatCell(v.type)}</td>
            <td className="px-5 py-4 text-ui-muted">{v.providerName ?? '—'}</td>
            <td className="px-5 py-4">
              <Badge tone={statusTone(v.status)}>{formatCell(v.status)}</Badge>
              {v.failureReason && <p className="mt-1 max-w-xs text-xs text-ui-muted">{v.failureReason}</p>}
            </td>
            <td className="px-5 py-4 text-ui-muted">{formatDate(v.updatedAt)}</td>
            <td className="w-72 px-5 py-4">
              <VerificationReviewActions verificationId={v.id} />
            </td>
          </tr>
        ))}
      </Table>
    </AdminFrame>
  );
}
