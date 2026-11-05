import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { listMyComplaints } from '@/lib/services/profile';
import { formatDate } from '@/lib/format';
import { TopBar } from '@/components/mobile/shell';
import { Icon } from '@/components/ui/icons';
import { StatusPill } from '@/components/ui/primitives';
import { ComplaintForm } from '@/components/mobile/forms/complaint-form';
import { FAQ_ITEMS } from '@/lib/content';

export const metadata = { title: 'Help and support' };

export default async function HelpPage() {
  const user = await requirePageUser('/app/help');
  const complaints = await listMyComplaints(user.id);
  return (
    <main className="pb-12">
      <TopBar back="/app/donor" title="Help and support" />
      <div className="space-y-8 px-5">
        <section className="surface-flat flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/15 text-mint">
            <Icon name="message" className="h-6 w-6" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">We are here to help</p>
            <p className="mt-1 text-ui-muted">
              Email{' '}
              <a href="mailto:support@helptrust.in" className="text-mint">
                support@helptrust.in
              </a>{' '}
              · Mon to Sat, 10:00 to 18:00 IST
            </p>
          </div>
        </section>

        <section aria-labelledby="faq-h">
          <h2 id="faq-h" className="mb-3 text-[17px] font-semibold">
            Common questions
          </h2>
          <div className="space-y-2">
            {FAQ_ITEMS.slice(0, 6).map((f) => (
              <details key={f.q} className="surface-flat group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                  {f.q}
                  <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-ui-muted transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ui-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className="mt-3 inline-block text-sm font-semibold text-mint">
            All questions
          </Link>
        </section>

        <section aria-labelledby="contact-h">
          <h2 id="contact-h" className="mb-3 text-[17px] font-semibold">
            Send us a message
          </h2>
          <ComplaintForm />
        </section>

        {complaints.length > 0 && (
          <section aria-labelledby="mine-h">
            <h2 id="mine-h" className="mb-3 text-[17px] font-semibold">
              Your messages
            </h2>
            <ul className="space-y-3">
              {complaints.map((c) => (
                <li key={c.id} className="surface-flat p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{c.subject}</p>
                    <StatusPill tone={c.status === 'RESOLVED' || c.status === 'CLOSED' ? 'mint' : 'amber'}>{c.status.toLowerCase().replace('_', ' ')}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-ui-subtle">{formatDate(c.createdAt)}</p>
                  {c.response && <p className="mt-3 rounded-xl bg-white/[0.03] p-3 text-sm text-ui-muted">{c.response}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
