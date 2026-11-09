import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { getServerT } from '@/lib/server/locale';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { RANK_LABELS, type Rank } from '@/lib/domain/rank-type';
import { AppShell, type NavItem } from '@/components/shell/shell';
import type { MessageKey } from '@/lib/i18n/messages';

export const dynamic = 'force-dynamic';

const ITEMS: { href: string; label: MessageKey; icon: string }[] = [
  { href: '/dashboard', label: 'nav.home', icon: 'home' },
  { href: '/ads', label: 'nav.earnWithAds', icon: 'play' },
  { href: '/shop', label: 'nav.shop', icon: 'bag' },
  { href: '/spin', label: 'nav.spinWin', icon: 'spin' },
  { href: '/tree', label: 'nav.binaryTree', icon: 'tree' },
  { href: '/earnings', label: 'nav.earnings', icon: 'chart' },
  { href: '/offers', label: 'nav.partnerOffers', icon: 'store' },
  { href: '/wallet', label: 'nav.wallet', icon: 'wallet' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const t = await getServerT();
  const role = user.role as StaffRole;
  const isAdvertiser = role === 'ADVERTISER';
  const navItems: NavItem[] = ITEMS.map((i) => ({ href: i.href, label: t(i.label), icon: i.icon }));
  // Advertisers get their console first, so it is in the phone bar too.
  const items: NavItem[] = isAdvertiser ? [{ href: '/advertiser', label: t('nav.advertiserConsole'), icon: 'store' }, ...navItems] : navItems;
  const isStaff = can(role, 'withdrawals:decide') || can(role, 'orders:transition') || can(role, 'ads:review') || can(role, 'merchants:manage');
  const rankName = isAdvertiser
    ? t('nav.advertiser')
    : t(`rank.${(user.rank as Rank) in RANK_LABELS ? user.rank : 'MEMBER'}` as MessageKey);
  return (
    <AppShell items={items} userName={user.name} rank={rankName} isStaff={isStaff}>
      {children}
    </AppShell>
  );
}
