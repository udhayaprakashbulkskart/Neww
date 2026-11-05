import { Notice } from '@/components/ui/primitives';

/** Layout for legal pages. The banner is shown until counsel signs off on the text. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 lg:px-8">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-4 text-[40px] font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-ui-subtle">Last updated {updated}</p>
      <div className="mt-8">
        <Notice tone="warning">
          Draft for launch. This text must be reviewed by qualified Indian counsel before live donations are accepted. It describes how the platform is designed to work and does not replace legal advice.
        </Notice>
      </div>
      <div className="prose-legal mt-10 space-y-6 text-[15px] leading-relaxed text-ui-muted">{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[19px] font-semibold text-ui-text">{title}</h2>
      {children}
    </section>
  );
}
