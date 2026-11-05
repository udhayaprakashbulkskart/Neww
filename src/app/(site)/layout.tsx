import Link from 'next/link';
import { Icon, Logo } from '@/components/ui/icons';
import { getCurrentUser } from '@/lib/auth/session';

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/explore', label: 'Explore' },
  { href: '/request-help', label: 'Request help' },
  { href: '/support-a-cause', label: 'Support a cause' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-dvh bg-ink-950">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-mint focus:px-4 focus:py-2 focus:text-ink-950">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="HelpTrust home">
            <Logo className="h-9 w-9" />
            <span className="text-[17px] font-bold tracking-tight">HelpTrust</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium text-ui-muted lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition hover:text-ui-text">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/app/home" className="btn-primary btn-sm">
                Open app
              </Link>
            ) : (
              <>
                <Link href="/app/login" className="btn-ghost btn-sm hidden sm:inline-flex">
                  Log in
                </Link>
                <Link href="/app/register" className="btn-primary btn-sm">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
        <nav aria-label="Secondary" className="no-scrollbar flex gap-5 overflow-x-auto border-t border-white/[0.04] px-5 py-3 text-sm text-ui-muted lg:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="shrink-0">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <div id="content">{children}</div>

      <footer className="mt-24 border-t border-white/[0.06] bg-ink-900/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <Logo className="h-9 w-9" />
              <span className="text-lg font-bold">HelpTrust</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ui-muted">Real People. Real Problems. Verified Help. A trusted platform for genuine financial support in India.</p>
            <p className="mt-4 flex items-center gap-2 text-xs text-ui-subtle">
              <Icon name="shield" className="h-4 w-4 text-mint" />
              Payments are processed by an authorised payment aggregator. We never see your card details.
            </p>
          </div>
          <FooterCol
            title="Platform"
            links={[
              ['How it works', '/how-it-works'],
              ['Explore campaigns', '/explore'],
              ['Request help', '/request-help'],
              ['Support a cause', '/support-a-cause'],
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              ['About us', '/about'],
              ['Contact', '/contact'],
              ['FAQ', '/faq'],
              ['Help in the app', '/app/help'],
            ]}
          />
          <div className="md:col-span-4 flex flex-col gap-4 border-t border-white/[0.06] pt-6 text-xs text-ui-subtle md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} HelpTrust. All rights reserved.</p>
            <div className="flex flex-wrap gap-5">
              <Link href="/privacy" className="hover:text-ui-muted">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-ui-muted">
                Terms
              </Link>
              <Link href="/refund-policy" className="hover:text-ui-muted">
                Refund Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-4 space-y-3 text-sm text-ui-muted">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="hover:text-ui-text">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
