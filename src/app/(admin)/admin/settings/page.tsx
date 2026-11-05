import { getPlatformSettings, listAudit } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { db } from '@/lib/db';
import { AdminFrame, PageTitle, Table } from '@/components/admin/shell';
import { SettingsControl } from '@/components/admin/actions';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Settings' };

const SETTINGS: { key: string; label: string; kind: 'number' | 'boolean' | 'string'; help: string; fallback: unknown }[] = [
  { key: 'donation_min_paise', label: 'Minimum donation (paise)', kind: 'number', help: 'Default ₹50 = 5000 paise. Enforced on the server.', fallback: 5000 },
  { key: 'donation_max_paise', label: 'Maximum donation (paise)', kind: 'number', help: 'Default ₹5,00,000 = 50000000 paise.', fallback: 50000000 },
  { key: 'maintenance_mode', label: 'Maintenance mode', kind: 'boolean', help: 'Shows a notice to users. Donations are paused while on.', fallback: false },
];

export default async function SettingsAdmin() {
  const { user, perms } = await adminContext(PERMISSIONS.SETTINGS_MANAGE);
  const [stored, audit, actors] = await Promise.all([getPlatformSettings(), listAudit({ page: 1 }), db.user.findMany({ select: { id: true, fullName: true } })]);
  const names = new Map(actors.map((a) => [a.id, a.fullName]));

  return (
    <AdminFrame permissions={perms} active="/admin/settings" name={user.fullName}>
      <PageTitle title="Settings" description="Platform configuration. Secrets are never stored here; they live in the server environment." />

      <section aria-labelledby="cfg-h" className="surface-flat divide-y divide-white/[0.06]">
        <h2 id="cfg-h" className="sr-only">
          Configuration
        </h2>
        {SETTINGS.map((s) => (
          <div key={s.key} className="grid gap-4 p-6 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <p className="font-semibold">{s.label}</p>
              <p className="mt-1 text-xs text-ui-subtle">{s.help}</p>
            </div>
            <SettingsControl settingKey={s.key} value={stored[s.key] ?? s.fallback} kind={s.kind} />
          </div>
        ))}
      </section>

      <section className="mt-10" aria-labelledby="audit-h">
        <h2 id="audit-h" className="mb-4 font-semibold">
          Audit history
        </h2>
        <p className="mb-4 text-xs text-ui-subtle">Most recent 50 privileged or money-moving actions. Entries cannot be edited from this screen.</p>
        <Table head={['When', 'Who', 'Action', 'Record', 'IP']} empty="No audited actions yet.">
          {audit.map((a) => (
            <tr key={a.id} className="hover:bg-white/[0.02]">
              <td className="px-5 py-3 text-ui-muted">{formatDateTime(a.createdAt)}</td>
              <td className="px-5 py-3">{a.actorId ? names.get(a.actorId) ?? 'Unknown' : 'System'}</td>
              <td className="px-5 py-3 font-mono text-xs">{a.action}</td>
              <td className="px-5 py-3 text-xs text-ui-muted">
                {a.entityType} · <span className="font-mono">{a.entityId.slice(0, 12)}</span>
              </td>
              <td className="px-5 py-3 font-mono text-xs text-ui-subtle">{a.ip ?? '—'}</td>
            </tr>
          ))}
        </Table>
      </section>
    </AdminFrame>
  );
}
