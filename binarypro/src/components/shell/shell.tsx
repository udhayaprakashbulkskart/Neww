import Link from 'next/link';
import { Icon } from './icons';
import { NavLink } from './nav-link';
import { Logo } from '@/components/ui';
import { LogoutButton } from '@/components/client';

export interface NavItem { href: string; label: string; icon: string }

export function AppShell({ children, items, userName, rank, isStaff }: {
  children: React.ReactNode; items: NavItem[]; userName: string; rank: string; isStaff: boolean;
}) {
  const initials = userName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-[#060606] p-5 lg:flex">
        <Link href="/dashboard" className="mb-8 block"><Logo /></Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {items.map((it) => <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon} variant="side" />)}
          {isStaff && (
            <Link href="/admin" className="mt-4 flex items-center gap-3 rounded-xl border border-orange-500/30 px-3 py-2.5 text-sm font-semibold text-orange-300 hover:bg-orange-500/10">
              <Icon name="shield" className="h-4 w-4" /> Admin console
            </Link>
          )}
        </nav>
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-sm font-black text-black">{initials}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{userName}</div>
              <div className="text-xs text-[#f7e09a]">{rank}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2"><Link href="/account" className="text-xs font-semibold text-[#f7e09a] hover:text-white">Account and delete account</Link><LogoutButton /></div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-x-hidden">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-black/85 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/dashboard"><Logo /></Link>
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-xs font-semibold text-[#f7e09a]">Account</Link>
            <span className="text-xs text-[#f7e09a]">{rank}</span>
            <LogoutButton />
          </div>
        </header>
        <div className="hidden items-center justify-between border-b border-white/5 bg-black/60 px-10 py-4 lg:flex">
          <div className="text-sm text-[#8f8672]">Welcome back, <span className="font-semibold text-white">{userName}</span></div>
          <div className="flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-1.5 text-xs font-semibold text-[#f7e09a]">{rank}</div>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-black/90 px-2 py-1.5 shadow-[0_-10px_40px_rgba(0,0,0,.6)] backdrop-blur lg:hidden" aria-label="Main mobile">
        {items.slice(0, 5).map((it) => <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon} variant="bottom" />)}
      </nav>
    </div>
  );
}
