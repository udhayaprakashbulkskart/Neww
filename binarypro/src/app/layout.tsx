import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { SupportChat } from '@/components/support/support-chat';
import { RegionProvider, RegionSwitcher } from '@/components/region/region-context';

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'CrownTree', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  title: 'CrownTree - Lead · Grow · Prosper',
  description: 'CrownTree: retail-led membership with binary team rewards, cashback and advertising rewards.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black">
        <ServiceWorkerRegister />
        <RegionProvider>
          {children}
          <SupportChat />
          <footer className="border-t border-white/5 bg-black">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <div className="text-lg font-black tracking-[.06em]">CROWN<span className="gold-text">TREE</span></div>
              <p className="text-xs leading-relaxed text-[#8f8672]">Global Business Network. Lead · Grow · Prosper.</p>
            </div>
            <nav aria-label="Platform" className="space-y-2 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">Platform</div>
              <a className="block text-[#b9b09a] hover:text-white" href="/#plans">Membership plans</a>
              <a className="block text-[#b9b09a] hover:text-white" href="/#earn">Earn with ads</a>
              <a className="block text-[#b9b09a] hover:text-white" href="/#tree">Binary team</a>
              <a className="block text-[#b9b09a] hover:text-white" href="/install">Download app</a>
            </nav>
            <nav aria-label="Policies" className="space-y-2 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">Policies</div>
              <a className="block text-[#b9b09a] hover:text-white" href="/terms">Terms and conditions</a>
              <a className="block text-[#b9b09a] hover:text-white" href="/privacy">Privacy policy</a>
              <a className="block text-[#b9b09a] hover:text-white" href="/refund">Refund and returns</a>
              <a className="block text-[#b9b09a] hover:text-white" href="/compliance">Compliance statement</a>
            </nav>
            <div className="space-y-2 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">Support</div>
              <p className="text-[#b9b09a]">Need help? Open the support chat at the bottom right.</p>
              <p className="text-xs text-[#6f6758]">CrownTree does not guarantee income. Read the compliance statement before joining.</p>
              <RegionSwitcher />
            </div>
          </div>
          <div className="border-t border-white/5 px-6 py-5 text-center text-xs text-[#6f6758]">© {new Date().getFullYear()} CrownTree. All rights reserved.</div>
          </footer>
        </RegionProvider>
      </body>
    </html>
  );
}
