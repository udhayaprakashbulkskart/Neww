import { PublicHeader } from '@/components/public-header';

export const LAST_UPDATED = '8 November 2026';

export interface LegalSection { id: string; title: string; body: string[] }

/** Shared layout for policy pages. Every page carries a draft notice until counsel has reviewed it. */
export function LegalPage({ title, intro, sections, current }: { title: string; intro: string; sections: LegalSection[]; current: string }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto grid max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-1 text-sm" aria-label="Policies">
            {[['/terms', 'Terms and conditions'], ['/privacy', 'Privacy policy'], ['/refund', 'Refund and returns'], ['/compliance', 'Compliance']].map(([href, label]) => (
              <a key={href} href={href} className={`block rounded-lg px-3 py-2 ${current === href ? 'bg-white/[0.06] text-white' : 'text-[#8f8672] hover:text-white'}`}>{label}</a>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 space-y-10">
          <header className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">Policy</p>
            <h1 className="text-4xl font-black tracking-tight">{title}</h1>
            <p className="text-sm text-[#8f8672]">Last updated: {LAST_UPDATED}</p>
            <p className="max-w-3xl text-[#b9b09a]">{intro}</p>
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-100">
              Draft for review. This text must be checked by qualified legal counsel before it is relied on. Items in [square brackets] must be completed by the company.
            </div>
          </header>
          <nav className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm lg:hidden" aria-label="On this page">
            <ol className="list-decimal space-y-1 pl-5 text-[#b9b09a]">
              {sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="hover:text-white">{s.title}</a></li>)}
            </ol>
          </nav>
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 space-y-3">
              <h2 className="text-xl font-bold">{s.title}</h2>
              {s.body.map((p, i) => <p key={i} className="leading-relaxed text-[#cfc6b0]">{p}</p>)}
            </section>
          ))}
          <footer className="border-t border-white/10 pt-6 text-sm text-[#8f8672]">
            Questions about these policies? Contact us at [support email]. Grievance Officer: [name, address, email, phone] (as required under the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020).
          </footer>
        </article>
      </main>
    </>
  );
}
