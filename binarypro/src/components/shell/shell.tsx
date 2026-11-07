import Link from 'next/link';
import { Icon } from './icons';
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
          {items.map((it) => (
            <Link key={it.href} href={it.href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#b9b09a] transition hover:bg-white/5 hover:text-white">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-[#f7e09a] group-hover:bg-[linear-gradient(135deg,#ff6a00,#d4af37)] group-hover:text-black"><Icon name={it.icon} className="h-4 w-4" /></span>
              {it.label}
            </Link>
          ))}
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
          <div className="mt-3"><LogoutButton /></div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-black/85 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/dashboard"><Logo /></Link>
          <div className="text-xs text-[#f7e09a]">{rank}</div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-black/90 p-2 shadow-2xl backdrop-blur lg:hidden" aria-label="Main mobile">
        {items.slice(0, 5).map((it) => (
          <Link key={it.href} href={it.href} className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium text-[#a39a86] hover:text-[#f7e09a]">
            <Icon name={it.icon} className="h-5 w-5" />
            {it.label.split(' ')[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
