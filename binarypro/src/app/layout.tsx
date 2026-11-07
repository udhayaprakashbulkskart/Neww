import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/sw-register';

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
        {children}
        <footer className="mx-auto max-w-7xl px-6 pb-10 pt-6 text-xs text-[#6f6758]">
          <div className="flex flex-wrap gap-5">
            <a href="/compliance">Compliance</a>
            <a href="/compliance#privacy">Privacy</a>
            <a href="/compliance#terms">Terms</a>
            <span>© CrownTree</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
