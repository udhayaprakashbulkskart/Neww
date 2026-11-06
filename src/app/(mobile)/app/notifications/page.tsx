import { requirePageUser } from '@/lib/auth/session';
import { listNotifications } from '@/lib/services/profile';
import { timeAgo } from '@/lib/format';
import { TopBar } from '@/components/mobile/shell';
import { EmptyState } from '@/components/ui/primitives';
import { Icon, type IconName } from '@/components/ui/icons';
import { MarkAllRead } from '@/components/mobile/forms/mark-all-read';

export const metadata = { title: 'Notifications' };

const ICON: Partial<Record<string, IconName>> = {
  PAYMENT_CONFIRMATION: 'checkCircle',
  DONATION_RECEIVED: 'heart',
  CAMPAIGN_STATUS: 'shield',
  DOCUMENT_REVIEW: 'file',
  VERIFICATION_UPDATE: 'idCard',
  REFUND_UPDATE: 'refund',
  COMPLAINT_UPDATE: 'help',
};

export default async function NotificationsPage() {
  const user = await requirePageUser('/app/notifications');
  const items = await listNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <main className="pb-10">
      <TopBar back="/app/home" title="Notifications" subtitle={unread ? `${unread} unread` : 'All caught up'} right={unread ? <MarkAllRead /> : null} />
      <div className="px-5">
        {items.length === 0 ? (
          <EmptyState icon="bell" title="No notifications" body="Updates about your campaigns, donations and verification appear here." />
        ) : (
          <ul className="space-y-3">
            {items.map((n) => {
              const inner = (
                <div className="flex gap-4">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${n.readAt ? 'bg-white/5 text-ui-muted' : 'bg-mint/15 text-mint'}`}>
                    <Icon name={ICON[n.type] ?? 'bell'} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm ${n.readAt ? 'font-medium text-ui-muted' : 'font-semibold'}`}>{n.title}</p>
                      <span className="shrink-0 text-[11px] text-ui-subtle">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ui-muted">{n.body}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className={`surface-flat p-4 ${n.readAt ? '' : 'border-mint/20'}`}>
                  {n.link ? (
                    <a href={n.link} className="block">
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
