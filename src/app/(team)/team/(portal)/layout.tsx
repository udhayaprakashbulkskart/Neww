import { requireTeamPage } from '@/lib/team/session';
import { PortalBottomNav, PortalSidebar } from '@/components/team/nav';

export const dynamic = 'force-dynamic';

/** Every portal page requires a signed-in, active team member. Sidebar on desktop, bottom bar on mobile. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireTeamPage();
  return (
    <div className="flex min-h-dvh bg-tp-canvas text-tp-ink">
      <PortalSidebar name={actor.fullName} isAdmin={actor.isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-tp-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <span className="flex items-center gap-2.5 text-sm font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tp-purple text-xs font-extrabold text-white">TP</span>
            Team Portal
          </span>
          <span className="max-w-[50%] truncate text-xs font-medium text-tp-muted">{actor.fullName}</span>
        </header>
        <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:pb-10">{children}</main>
      </div>
      <PortalBottomNav isAdmin={actor.isAdmin} />
    </div>
  );
}
