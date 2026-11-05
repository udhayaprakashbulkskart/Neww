import { listStaff } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { StaffRoleControl } from '@/components/admin/actions';

export const metadata = { title: 'Staff' };

export default async function StaffAdmin() {
  const { user, perms } = await adminContext(PERMISSIONS.STAFF_MANAGE);
  const { staff, roles } = await listStaff();

  return (
    <AdminFrame permissions={perms} active="/admin/staff" name={user.fullName}>
      <PageTitle title="Staff and roles" description="Access is granted by role. Changes take effect on the person's next request and are audited." />

      <section aria-labelledby="roles-h" className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <h2 id="roles-h" className="sr-only">
          Roles
        </h2>
        {roles.map((r) => (
          <div key={r.key} className="surface-flat p-5">
            <p className="font-semibold">{r.name}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ui-muted">{r.description}</p>
          </div>
        ))}
      </section>

      <Table head={['Name', 'Mobile', 'Account', 'Roles', 'Change role']} empty="No staff accounts yet. Assign a role to an existing user below.">
        {staff.map((s) => (
          <tr key={s.id} className="align-top hover:bg-white/[0.02]">
            <td className="px-5 py-4 font-medium">{s.fullName}</td>
            <td className="px-5 py-4 font-mono text-xs text-ui-muted">••••••{s.mobileLast4}</td>
            <td className="px-5 py-4">
              <Badge tone={statusTone(s.status)}>{formatCell(s.status)}</Badge>
            </td>
            <td className="px-5 py-4 text-ui-muted">{s.roles.map((r) => r.role.name).join(', ') || '—'}</td>
            <td className="w-96 px-5 py-4">
              <StaffRoleControl userId={s.id} roles={s.roles.map((r) => r.role.key)} options={roles.map((r) => ({ key: r.key, name: r.name }))} />
            </td>
          </tr>
        ))}
      </Table>
      <p className="mt-6 text-xs text-ui-subtle">To add a new staff member, they must first create a HelpTrust account. Enter their user ID from the Users screen to assign a role.</p>
    </AdminFrame>
  );
}
