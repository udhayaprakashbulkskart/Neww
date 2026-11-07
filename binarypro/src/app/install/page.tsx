import { PublicHeader } from '@/components/public-header';
import { InstallButton } from '@/components/install-button';
import { Notice } from '@/components/ui';

export const metadata = { title: 'Download CrownTree app' };

export default function InstallPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-4xl space-y-12 px-6 py-16">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">Download</p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Get the <span className="gold-text">CrownTree app</span></h1>
          <p className="max-w-2xl text-[#a39a86]">Install CrownTree on your phone or computer for one-tap access, full-screen layout and faster loading. It works from the same account as the website.</p>
          <div className="pt-2"><InstallButton /></div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
            <h2 className="text-lg font-bold">Android (Chrome, Samsung Internet)</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[#b9b09a]">
              <li>Open this page in Chrome.</li>
              <li>Tap <strong>Install CrownTree</strong>, or open the menu and choose <strong>Install app</strong>.</li>
              <li>Confirm. The icon appears on your home screen.</li>
            </ol>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
            <h2 className="text-lg font-bold">iPhone and iPad (Safari)</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[#b9b09a]">
              <li>Open this page in Safari, not another browser.</li>
              <li>Tap the <strong>Share</strong> button.</li>
              <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
            </ol>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:col-span-2">
            <h2 className="text-lg font-bold">Windows, Mac and Chromebook (Chrome, Edge)</h2>
            <p className="mt-3 text-sm text-[#b9b09a]">Click the install icon in the address bar, or open the menu and choose <strong>Install CrownTree</strong>. The app opens in its own window.</p>
          </div>
        </section>

        <Notice>
          This is an installable web app. Native app-store releases for Google Play and the Apple App Store are a separate build and need publisher accounts and store review. Ask for them when you are ready to publish.
        </Notice>
      </main>
    </>
  );
}
