import Link from 'next/link';
import { Icon, Logo, type IconName } from '@/components/ui/icons';
import { PERMISSIONS } from '@/lib/rbac';

export const ADMIN_NAV: { href: string; label: string; icon: IconName; permission: string }[] = [
  { href: '/admin', label: 'Overview', icon: 'grid', permission: PERMISSIONS.OVERVIEW_VIEW },
  { href: '/admin/users', label: 'Users', icon: 'users', permission: PERMISSIONS.USER_VIEW },
  { href: '/admin/beneficiaries', label: 'Beneficiaries', icon: 'user', permission: PERMISSIONS.USER_VIEW },
  { href: '/admin/donors', label: 'Donors', icon: 'heart', permission: PERMISSIONS.USER_VIEW },
  { href: '/admin/campaigns', label: 'Campaigns', icon: 'file', permission: PERMISSIONS.CAMPAIGN_VIEW },
  { href: '/admin/verifications', label: 'Verification Queue', icon: 'idCard', permission: PERMISSIONS.VERIFICATION_REVIEW },
  { href: '/admin/documents', label: 'Documents', icon: 'upload', permission: PERMISSIONS.DOCUMENT_REVIEW },
  { href: '/admin/donations', label: 'Donations', icon: 'wallet', permission: PERMISSIONS.DONATION_VIEW },
  { href: '/admin/payments', label: 'Payments', icon: 'card', permission: PERMISSIONS.PAYMENT_VIEW },
  { href: '/admin/refunds', label: 'Refunds', icon: 'refund', permission: PERMISSIONS.REFUND_PROCESS },
  { href: '/admin/fraud', label: 'Fraud Reports', icon: 'shield', permission: PERMISSIONS.FRAUD_MANAGE },
  { href: '/admin/complaints', label: 'Complaints', icon: 'message', permission: PERMISSIONS.COMPLAINT_MANAGE },
  { href: '/admin/analytics', label: 'Analytics', icon: 'chart', permission: PERMISSIONS.OVERVIEW_VIEW },
  { href: '/admin/staff', label: 'Staff', icon: 'users', permission: PERMISSIONS.STAFF_MANAGE },
  { href: '/admin/settings', label: 'Settings', icon: 'settings', permission: PERMISSIONS.SETTINGS_MANAGE },
];

export function AdminSidebar({ permissions, active, name }: { permissions: Set<string>; active: string; name: string }) {
  const items = ADMIN_NAV.filter((n) => permissions.has(n.permission));
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/[0.06] bg-ink-900 lg:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        <Logo className="h-10 w-10" />
        <div>
          <p className="font-bold leading-tight">HelpTrust</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-mint">Admin</p>
        </div>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {items.map((n) => {
          const isActive = n.href === '/admin' ? active === '/admin' : active.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${isActive ? 'bg-mint/12 text-mint' : 'text-ui-muted hover:bg-white/[0.04] hover:text-ui-text'}`}
            >
              <Icon name={n.icon} className="h-[18px] w-[18px]" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.06] p-4 text-sm">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-xs text-ui-subtle">Signed in as staff</p>
      </div>
    </aside>
  );
}

export function AdminFrame({ permissions, active, name, children }: { permissions: Set<string>; active: string; name: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-ink-950">
      <AdminSidebar permissions={permissions} active={active} name={name} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1280px] px-6 py-8 lg:px-10">{children}</div>
      </div>
    </div>
  );
}

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ui-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'default' }: { label: string; value: string | number; hint?: string; tone?: 'default' | 'mint' | 'warn' | 'danger' }) {
  const color = tone === 'mint' ? 'text-mint' : tone === 'warn' ? 'text-ui-warning' : tone === 'danger' ? 'text-ui-danger' : 'text-ui-text';
  return (
    <div className="surface-flat p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ui-subtle">{label}</p>
      <p className={`mt-2 text-[26px] font-extrabold tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ui-subtle">{hint}</p>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0;
  return (
    <div className="surface-flat overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-ink-900/60 text-[11px] uppercase tracking-wider text-ui-subtle">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="px-5 py-3.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">{children}</tbody>
        </table>
      </div>
      {rows === 0 && <p className="px-5 py-10 text-center text-sm text-ui-muted">{empty ?? 'Nothing to show yet.'}</p>}
    </div>
  );
}

export function Badge({ tone = 'grey', children }: { tone?: 'mint' | 'amber' | 'red' | 'grey' | 'sky'; children: React.ReactNode }) {
  const map = {
    mint: 'bg-mint/12 text-mint',
    amber: 'bg-ui-warning/12 text-ui-warning',
    red: 'bg-ui-danger/12 text-ui-danger',
    grey: 'bg-white/[0.06] text-ui-muted',
    sky: 'bg-pastel-sky/12 text-pastel-sky',
  } as const;
  return <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${map[tone]}`}>{children}</span>;
}

export function statusTone(s: string): 'mint' | 'amber' | 'red' | 'grey' | 'sky' {
  if (['APPROVED', 'PUBLISHED', 'VERIFIED', 'SUCCESS', 'CAPTURED', 'PROCESSED', 'APPROVED_REFUND', 'RESOLVED', 'ACTIVE'].includes(s)) return 'mint';
  if (['PENDING', 'UNDER_REVIEW', 'OPEN', 'IN_PROGRESS', 'SUBMITTED', 'CREATED', 'AUTHORIZED', 'REQUESTED', 'UNDER_INVESTIGATION'].includes(s)) return 'sky';
  if (['ADDITIONAL_INFO_REQUIRED', 'ADDITIONAL_REQUIRED', 'PENDING_VERIFICATION', 'HIGH', 'MEDIUM'].includes(s)) return 'amber';
  if (['REJECTED', 'FAILED', 'SUSPENDED', 'CRITICAL', 'CONFIRMED'].includes(s)) return 'red';
  return 'grey';
}

export function formatCell(s: string | null | undefined) {
  return s ? s.toLowerCase().replace(/_/g, ' ') : '—';
}
