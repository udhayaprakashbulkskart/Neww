import Link from 'next/link';
import { Icon } from '@/components/ui/icons';

export const metadata = { title: 'Request financial help', description: 'Ask for verified financial help for debt, medical, education or emergency needs.' };

const WHAT_YOU_NEED = [
  ['Government ID', 'Aadhaar, PAN, passport or voter ID. Used only for verification.'],
  ['Proof of address', 'A recent bill or statement with your name and address.'],
  ['A bill or loan statement', 'Shows the amount you owe or have been asked to pay.'],
  ['A bank account in your name', 'Funds are paid only to a verified account.'],
];

export default function RequestHelpPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-20 lg:px-8">
      <p className="eyebrow">Request help</p>
      <h1 className="mt-4 text-balance text-[40px] font-extrabold leading-tight tracking-tight md:text-[52px]">Ask for help. We will check it properly.</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ui-muted">
        Verification protects you as well as donors. A checked campaign is more likely to be trusted, and your private information stays private.
      </p>

      <div className="mt-14 grid gap-5 md:grid-cols-2">
        {WHAT_YOU_NEED.map(([t, b]) => (
          <div key={t} className="surface flex gap-4 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint/15 text-mint">
              <Icon name="check" className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div>
              <p className="font-semibold">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ui-muted">{b}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 surface-flat grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-lg font-bold">Your request is private until it is verified.</p>
          <p className="mt-2 text-sm leading-relaxed text-ui-muted">
            Only a campaign that has been approved is shown to donors. You can see its status at every step, and you can save a draft and come back later.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/app/register" className="btn-primary">
            Start your request
          </Link>
          <Link href="/faq" className="btn-ghost">
            Read the FAQ
          </Link>
        </div>
      </div>
    </main>
  );
}
