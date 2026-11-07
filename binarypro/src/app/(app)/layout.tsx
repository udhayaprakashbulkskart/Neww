import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { RANK_LABELS, type Rank } from '@/lib/domain/rank-type';
import { AppShell, type NavItem } from '@/components/shell/shell';

export const dynamic = 'force-dynamic';

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/ads', label: 'Earn with ads', icon: 'play' },
  { href: '/shop', label: 'Shop', icon: 'bag' },
  { href: '/tree', label: 'Binary tree', icon: 'tree' },
  { href: '/earnings', label: 'Earnings', icon: 'chart' },
  { href: '/wallet', label: 'Wallet', icon: 'wallet' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const role = user.role as StaffRole;
  const isAdvertiser = role === 'ADVERTISER';
  // Advertisers get their console first, so it is in the phone bar too.
  const items = isAdvertiser ? [{ href: '/advertiser', label: 'Advertiser console', icon: 'store' }, ...ITEMS] : ITEMS;
  const isStaff = can(role, 'withdrawals:decide') || can(role, 'orders:transition') || can(role, 'ads:review') || can(role, 'merchants:manage');
  return (
    <AppShell items={items} userName={user.name} rank={isAdvertiser ? 'Advertiser' : RANK_LABELS[user.rank as Rank]} isStaff={isStaff}>
      {children}
    </AppShell>
  );
}
