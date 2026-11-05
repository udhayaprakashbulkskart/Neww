import Link from 'next/link';
import { FAQ_ITEMS } from '@/lib/content';
import { Icon } from '@/components/ui/icons';

export const metadata = { title: 'FAQ' };

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 lg:px-8">
      <p className="eyebrow">FAQ</p>
      <h1 className="mt-4 text-[40px] font-extrabold leading-tight tracking-tight">Questions, answered plainly</h1>
      <div className="mt-10 space-y-3">
        {FAQ_ITEMS.map((f) => (
          <details key={f.q} className="surface-flat group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
              {f.q}
              <Icon name="chevronDown" className="h-5 w-5 shrink-0 text-ui-muted transition group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-[15px] leading-relaxed text-ui-muted">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-12 text-sm text-ui-muted">
        Still stuck?{' '}
        <Link href="/contact" className="font-semibold text-mint">
          Contact us
        </Link>
        .
      </p>
    </main>
  );
}
