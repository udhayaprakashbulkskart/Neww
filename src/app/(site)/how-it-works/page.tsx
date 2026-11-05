import Link from 'next/link';
import { Icon } from '@/components/ui/icons';

export const metadata = { title: 'How it works' };

const REQUESTER = [
  'Create an account with your mobile number and accept the terms.',
  'Choose "I Need Help" and describe your situation in your own words.',
  'Upload a government ID, proof of address and a bill or loan statement.',
  'Confirm your identity and address with our authorised verification partner.',
  'Add your bank account, which must be in your own name, and verify it.',
  'Submit. A verification officer reviews the file, and we tell you the result.',
];

const DONOR = [
  'Browse verified campaigns by category, city, funding status or urgency.',
  'Pick an amount from ₹100 upward, or enter your own, and choose anonymity if you prefer.',
  'Pay with UPI, card, net banking or RuPay through our payment provider.',
  'Your donation is confirmed when the provider confirms it to us, and you get a receipt.',
  'Track your giving in your donor dashboard and request a refund within 7 days if needed.',
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
      <p className="eyebrow">How it works</p>
      <h1 className="mt-4 text-[40px] font-extrabold leading-tight tracking-tight md:text-[52px]">A simple, transparent, secure process</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ui-muted">Whether you are asking for help or giving it, every step is designed so both sides can trust what they see.</p>

      <div className="mt-16 grid gap-8 lg:grid-cols-2">
        <section className="surface p-8" aria-labelledby="req-h">
          <h2 id="req-h" className="text-[24px] font-bold">
            If you need help
          </h2>
          <ol className="mt-6 space-y-5">
            {REQUESTER.map((t, i) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint/15 text-sm font-bold text-mint">{i + 1}</span>
                <span className="pt-1 text-[15px] leading-relaxed text-ui-muted">{t}</span>
              </li>
            ))}
          </ol>
          <Link href="/request-help" className="btn-primary mt-8 w-full">
            Request help
          </Link>
        </section>

        <section className="surface p-8" aria-labelledby="don-h">
          <h2 id="don-h" className="text-[24px] font-bold">
            If you want to help
          </h2>
          <ol className="mt-6 space-y-5">
            {DONOR.map((t, i) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pastel-pink/20 text-sm font-bold text-pastel-pink">{i + 1}</span>
                <span className="pt-1 text-[15px] leading-relaxed text-ui-muted">{t}</span>
              </li>
            ))}
          </ol>
          <Link href="/support-a-cause" className="btn-ghost mt-8 w-full">
            Support a cause
          </Link>
        </section>
      </div>

      <section className="mt-16 surface-flat grid gap-6 p-8 md:grid-cols-3" aria-label="Safeguards">
        {[
          ['lock', 'Encryption', 'Personal data and documents are encrypted at rest and only decrypted for authorised reviewers.'],
          ['shield', 'Signed confirmations', 'We mark a payment successful only after a cryptographically signed confirmation from the provider.'],
          ['alert', 'Human review', 'Automated checks raise flags for people to review. Nobody is accused or blocked on a score alone.'],
        ].map(([icon, title, body]) => (
          <div key={title as string}>
            <Icon name={icon as 'lock'} className="h-6 w-6 text-mint" />
            <p className="mt-4 font-semibold">{title}</p>
            <p className="mt-2 text-sm leading-relaxed text-ui-muted">{body as string}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
