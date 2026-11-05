import Link from 'next/link';
import { listUsers } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { formatDate } from '@/lib/format';

export type UsersSearchParams = { q?: string; status?: string; page?: string };

/** Shared user table. Beneficiaries and donors reuse it with a fixed account-type filter. */
export async function UsersScreen({
  title,
  active,
  types,
  searchParams,
  basePath,
}: {
  title: string;
  active: string;
  types?: ('BENEFICIARY' | 'DONOR' | 'BOTH')[];
  searchParams: UsersSearchParams;
  basePath: string;
}) {
  const { user, perms } = await adminContext(PERMISSIONS.USER_VIEW);
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const data = await listUsers({ q: searchParams.q, status: searchParams.status, page, userTypes: types });
  const qs = (p: number) => `${basePath}?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), ...(searchParams.status ? { status: searchParams.status } : {}), page: String(p) })}`;

  return (
    <AdminFrame permissions={perms} active={active} name={user.fullName}>
      <PageTitle title={title} description="Search by name or the last four digits of a mobile number. Full numbers and documents are never shown here." />
      <form action={basePath} className="mb-5 flex flex-wrap gap-3" role="search">
        <label htmlFor="uq" className="sr-only">
          Search users
        </label>
        <input id="uq" name="q" defaultValue={searchParams.q ?? ''} placeholder="Name or last 4 digits" className="h-11 w-72 rounded-2xl border border-white/[0.08] bg-ink-850 px-4 text-sm text-ui-text placeholder:text-ui-subtle focus:border-mint/50 focus:outline-none" />
        <label htmlFor="us" className="sr-only">
          Status
        </label>
        <select id="us" name="status" defaultValue={searchParams.status ?? 'ALL'} className="h-11 rounded-2xl border border-white/[0.08] bg-ink-850 px-4 text-sm text-ui-text focus:outline-none">
          {['ALL', 'ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED'].map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All statuses' : formatCell(s)}
            </option>
          ))}
        </select>
        <button className="btn-primary btn-sm h-11">Search</button>
      </form>
      <Table head={['Name', 'Mobile', 'Type', 'Campaigns', 'Donations', 'Status', 'Joined', 'Last login']} empty="No users match this search.">
        {data.items.map((u) => (
          <tr key={u.id} className="hover:bg-white/[0.02]">
            <td className="px-5 py-3.5">
              <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-mint">
                {u.fullName}
              </Link>
            </td>
            <td className="px-5 py-3.5 font-mono text-xs text-ui-muted">••••••{u.mobileLast4}</td>
            <td className="px-5 py-3.5 text-ui-muted">{formatCell(u.userType)}</td>
            <td className="px-5 py-3.5">{u._count.campaigns}</td>
            <td className="px-5 py-3.5">{u._count.donations}</td>
            <td className="px-5 py-3.5">
              <Badge tone={statusTone(u.status)}>{formatCell(u.status)}</Badge>
            </td>
            <td className="px-5 py-3.5 text-ui-muted">{formatDate(u.createdAt)}</td>
            <td className="px-5 py-3.5 text-ui-muted">{formatDate(u.lastLoginAt)}</td>
          </tr>
        ))}
      </Table>
      <nav aria-label="Pagination" className="mt-5 flex items-center justify-between text-sm text-ui-muted">
        {page > 1 ? <Link href={qs(page - 1)} className="font-semibold text-mint">← Previous</Link> : <span />}
        <span>
          Page {page} · {data.total} total
        </span>
        {page * 25 < data.total ? <Link href={qs(page + 1)} className="font-semibold text-mint">Next →</Link> : <span />}
      </nav>
    </AdminFrame>
  );
}

