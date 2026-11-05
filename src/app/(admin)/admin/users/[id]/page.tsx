import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { SuspendControl } from '@/components/admin/actions';
import { formatDate, formatINR } from '@/lib/format';

export const metadata = { title: 'User' };

export default async function UserDetail({ params }: { params: { id: string } }) {
  const { user: me, perms } = await adminContext(PERMISSIONS.USER_VIEW);
  const u = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      fullName: true,
      mobileLast4: true,
      userType: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      mobileVerifiedAt: true,
      profile: { select: { city: true, state: true, pincode: true } },
      campaigns: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, title: true, status: true, requestedPaise: true, raisedPaise: true } },
      donations: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, amountPaise: true, status: true, createdAt: true, campaign: { select: { title: true } } } },
      verifications: { select: { id: true, type: true, status: true } },
    },
  });
  if (!u) notFound();
  const canSuspend = await hasPermission(me.id, PERMISSIONS.USER_SUSPEND);

  return (
    <AdminFrame permissions={perms} active="/admin/users" name={me.fullName}>
      <PageTitle title={u.fullName} description={`Account ${formatCell(u.status)} · ${formatCell(u.userType)} · joined ${formatDate(u.createdAt)}`} actions={<Link href="/admin/users" className="btn-ghost btn-sm">Back to users</Link>} />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="surface-flat space-y-4 p-6 text-sm xl:col-span-1" aria-label="Account">
          <Row label="Mobile" value={`••••••${u.mobileLast4}`} />
          <Row label="Mobile verified" value={formatDate(u.mobileVerifiedAt)} />
          <Row label="Last login" value={formatDate(u.lastLoginAt)} />
          <Row label="Location" value={[u.profile?.city, u.profile?.state].filter(Boolean).join(', ') || '—'} />
          <Row label="Status" value={<Badge tone={statusTone(u.status)}>{formatCell(u.status)}</Badge>} />
          <div className="border-t border-white/[0.06] pt-4">
            <p className="mb-3 font-semibold">Verification</p>
            <ul className="space-y-2">
              {u.verifications.map((v) => (
                <li key={v.id} className="flex items-center justify-between">
                  <span className="text-ui-muted">{formatCell(v.type)}</span>
                  <Badge tone={statusTone(v.status)}>{formatCell(v.status)}</Badge>
                </li>
              ))}
              {u.verifications.length === 0 && <li className="text-ui-subtle">No checks started.</li>}
            </ul>
          </div>
          {canSuspend ? (
            <div className="border-t border-white/[0.06] pt-4">
              <p className="mb-3 font-semibold">Account action</p>
              <SuspendControl userId={u.id} suspended={u.status === 'SUSPENDED'} />
            </div>
          ) : null}
        </section>

        <div className="space-y-6 xl:col-span-2">
          <section aria-labelledby="c-h">
            <h2 id="c-h" className="mb-3 font-semibold">
              Campaigns
            </h2>
            <Table head={['Campaign', 'Status', 'Requested', 'Raised']} empty="No campaigns.">
              {u.campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/campaigns/${c.id}`} className="hover:text-mint">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={statusTone(c.status)}>{formatCell(c.status)}</Badge>
                  </td>
                  <td className="px-5 py-3.5">{formatINR(c.requestedPaise)}</td>
                  <td className="px-5 py-3.5">{formatINR(c.raisedPaise)}</td>
                </tr>
              ))}
            </Table>
          </section>
          <section aria-labelledby="d-h">
            <h2 id="d-h" className="mb-3 font-semibold">
              Donations
            </h2>
            <Table head={['Campaign', 'Amount', 'Status', 'Date']} empty="No donations.">
              {u.donations.map((d) => (
                <tr key={d.id}>
                  <td className="px-5 py-3.5">{d.campaign.title}</td>
                  <td className="px-5 py-3.5">{formatINR(d.amountPaise)}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={statusTone(d.status)}>{formatCell(d.status)}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-ui-muted">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
            </Table>
          </section>
        </div>
      </div>
    </AdminFrame>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ui-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
