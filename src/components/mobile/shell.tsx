'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/icons';

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/app/home', label: 'Home', icon: 'home', match: (p) => p === '/app/home' },
  { href: '/app/explore', label: 'Explore', icon: 'search', match: (p) => p.startsWith('/app/explore') || p.startsWith('/app/category') },
  { href: '/app/create', label: 'Create', icon: 'plus', match: (p) => p.startsWith('/app/create') },
  { href: '/app/saved', label: 'Saved', icon: 'bookmark', match: (p) => p.startsWith('/app/saved') },
  { href: '/app/donor', label: 'Profile', icon: 'user', match: (p) => ['/app/donor', '/app/beneficiary', '/app/settings', '/app/help', '/app/history', '/app/notifications'].some((x) => p.startsWith(x)) },
];

/** Tab roots only. Flows (checkout, wizard, detail pages) hide the bar so the primary action stays clear. */
export function shouldShowTabs(pathname: string) {
  return TABS.some((t) => t.match(pathname)) && !pathname.includes('/create/');
}

export function BottomNav() {
  const pathname = usePathname() ?? '';
  if (!shouldShowTabs(pathname)) return null;
  return (
    <nav aria-label="Main" className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
      <ul className="surface-flat flex items-center justify-between rounded-[26px] border-white/[0.08] bg-ink-900/90 px-2 py-2 backdrop-blur-xl">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const isCreate = t.label === 'Create';
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium"
              >
                {isCreate ? (
                  <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-mint-gradient text-ink-950 shadow-glow ring-4 ring-ink-950">
                    <Icon name="plus" className="h-6 w-6" strokeWidth={2.4} />
                  </span>
                ) : (
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${active ? 'bg-mint/15 text-mint' : 'text-ui-subtle'}`}>
                    <Icon name={t.icon} className="h-[22px] w-[22px]" />
                  </span>
                )}
                <span className={active || isCreate ? 'text-mint' : 'text-ui-subtle'}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Top bar used across mobile screens: optional back link, title and right-hand actions. */
export function TopBar({ title, back, right, subtitle }: { title?: string; back?: string; right?: React.ReactNode; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-ink-950/80 px-4 pb-3 pt-[max(env(safe-area-inset-top),16px)] backdrop-blur-xl">
      {back ? (
        <Link href={back} aria-label="Go back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-ink-850 text-ui-text transition hover:bg-ink-700">
          <Icon name="back" />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        {title && <h1 className="truncate text-[20px] font-bold tracking-tight">{title}</h1>}
        {subtitle && <p className="truncate text-xs text-ui-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/** Step progress for wizards and onboarding. */
export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i + 1 === current ? 'w-8 bg-mint' : i + 1 < current ? 'w-3 bg-mint/50' : 'w-3 bg-white/10'}`} />
      ))}
    </div>
  );
}
