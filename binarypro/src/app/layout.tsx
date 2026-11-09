import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { SupportChat } from '@/components/support/support-chat';
import { RegionProvider, PreferencesForm } from '@/components/region/region-context';
import { getRequestRegion } from '@/lib/server/locale';
import { REGIONS } from '@/lib/domain/region';

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'CrownTree', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  title: 'CrownTree - Lead · Grow · Prosper',
  description: 'CrownTree: retail-led membership with binary team rewards, cashback and advertising rewards.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const region = await getRequestRegion();
  const t = region.t;
  return (
    <html lang={region.locale} dir={region.dir}>
      <body className="min-h-screen bg-black">
        <RegionProvider value={{
          prefs: region.prefs,
          locale: region.locale,
          dir: region.dir,
          messages: region.messages,
          detectedCountry: region.detectedCountry,
          config: { enabledCountries: region.config.enabledCountries, enabledLanguages: region.config.enabledLanguages, enabledCurrencies: region.config.enabledCurrencies },
          signedIn: region.signedIn,
        }}>
          <ServiceWorkerRegister />
          {children}
          <SupportChat />
          <footer className="border-t border-white/5 bg-black">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-3">
                <div className="text-lg font-black tracking-[.06em]">CROWN<span className="gold-text">TREE</span></div>
                <p className="text-xs leading-relaxed text-[#8f8672]">{t('footer.tagline')}</p>
              </div>
              <nav aria-label={t('nav.platform')} className="space-y-2 text-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">{t('nav.platform')}</div>
                <a className="block text-[#b9b09a] hover:text-white" href="/#plans">{t('footer.membershipPlans')}</a>
                <a className="block text-[#b9b09a] hover:text-white" href="/#earn">{t('footer.earnWithAds')}</a>
                <a className="block text-[#b9b09a] hover:text-white" href="/#tree">{t('footer.binaryTeam')}</a>
                <a className="block text-[#b9b09a] hover:text-white" href="/install">{t('footer.downloadApp')}</a>
              </nav>
              <nav aria-label={t('nav.policies')} className="space-y-2 text-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">{t('nav.policies')}</div>
                <a className="block text-[#b9b09a] hover:text-white" href="/terms">{t('footer.terms')}</a>
                <a className="block text-[#b9b09a] hover:text-white" href="/privacy">{t('footer.privacyPolicy')}</a>
                <a className="block text-[#b9b09a] hover:text-white" href="/refund">{t('footer.refund')}</a>
                <a className="block text-[#b9b09a] hover:text-white" href="/compliance">{t('footer.compliance')}</a>
              </nav>
              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">{t('nav.support')}</div>
                  <p className="text-[#b9b09a]">{t('footer.supportText')}</p>
                  <p className="text-xs text-[#6f6758]">{t('footer.noGuarantee')}</p>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <PreferencesForm compact />
                  <p className="mt-2 text-[11px] text-[#6f6758]">{REGIONS[region.prefs.country]?.name ?? ''}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/5 px-6 py-5 text-center text-xs text-[#6f6758]">© {new Date().getFullYear()} CrownTree. {t('footer.rights')}</div>
          </footer>
        </RegionProvider>
      </body>
    </html>
  );
}
