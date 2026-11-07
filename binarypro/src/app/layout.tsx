import './globals.css';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/server/auth';
import { Logo } from '@/components/ui';
import { LogoutButton } from '@/components/client';
import { can, type StaffRole } from '@/lib/domain/rbac';

export const metadata: Metadata = {
  title: 'BinaryPro - Commerce. Community. Rewards.',
  description: 'BinaryPro: retail-led membership with binary team rewards, cashback and advertising rewards.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const isStaff = !!user && (can(user.role as StaffRole, 'withdrawals:read') || can(user.role as StaffRole, 'orders:transition') || can(user.role as StaffRole, 'merchants:manage') || can(user.role as StaffRole, 'ads:review'));
  const links = user
    ? [
        ['/dashboard', 'Dashboard'], ['/tree', 'Binary tree'], ['/shop', 'Shop'], ['/wallet', 'Wallet'], ['/ads', 'Earn with ads'],
        ...(isStaff ? [['/admin', 'Admin']] : []),
      ]
    : [];
  return (
    <html lang="en">
      <body className="min-h-screen bg-black">
        <header className="sticky top-0 z-30 border-b border-[#2a2116] bg-black/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" aria-label="BinaryPro home"><Logo /></Link>
            <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Main">
              {links.map(([href, label]) => (
                <Link key={href} href={href} className="rounded-lg px-3 py-2 text-[#d9d1bd] hover:bg-[#15110a] hover:text-[#f7e09a]">{label}</Link>
              ))}
              {user ? (
                <div className="ml-2 flex items-center gap-2"><span className="hidden text-xs text-[#a39a86] sm:inline">{user.name}</span><LogoutButton /></div>
              ) : (
                <Link href="/login" className="btn btn-brand px-4 py-2 text-xs">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-[#6f6758]">
          <div className="flex flex-wrap gap-4">
            <Link href="/compliance">Compliance</Link>
            <Link href="/compliance#privacy">Privacy</Link>
            <Link href="/compliance#terms">Terms</Link>
            <span>© BinaryPro</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
