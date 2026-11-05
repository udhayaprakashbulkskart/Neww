import { BottomNav } from '@/components/mobile/shell';

/**
 * Mobile app frame. On phones it fills the screen. On desktop it shows as a centred device-width
 * column so the reference design is preserved at every size.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden md:my-8 md:min-h-[860px] md:rounded-[44px] md:border md:border-white/10 md:bg-ink-900 md:shadow-card">
      {children}
      <BottomNav />
    </div>
  );
}
