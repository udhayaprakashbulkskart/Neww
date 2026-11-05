import Link from 'next/link';
import { Icon } from '@/components/ui/icons';

export const metadata = { title: 'About us', description: 'Why HelpTrust exists and how we keep giving trustworthy.' };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 lg:px-8">
      <p className="eyebrow">About HelpTrust</p>
      <h1 className="mt-4 text-[40px] font-extrabold leading-tight tracking-tight">Giving that people can trust, to people who need it.</h1>
      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ui-muted">
        <p>
          Too many families face a debt, a medical bill or a school fee they cannot meet, and too many good-hearted people want to help but do not know whom to trust. HelpTrust sits in the middle. People who need help can ask for it openly. Donors can see that a request has been checked before they give.
        </p>
        <p>
          We are building HelpTrust for India, with its laws, its payment systems and its everyday realities in mind. We are designing for the Digital Personal Data Protection Act, RBI-compliant payment arrangements, KYC and anti-money-laundering obligations, and the rules for fundraising. Some of these steps are still in progress. We say so openly rather than claiming more than we have done.
        </p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {[
          ['Verify before we publish', 'Identity, address, bank account and bills are checked. A person reviews each file.'],
          ['Protect private data', 'Documents and bank details are encrypted. Donors never see your ID number or documents.'],
          ['Show our working', 'Campaigns show what has been raised, how many people gave, and what has been checked.'],
          ['Be honest about limits', 'We do not promise outcomes, tax benefits or instant payouts.'],
        ].map(([t, b]) => (
          <div key={t} className="surface-flat p-6">
            <Icon name="check" className="h-5 w-5 text-mint" />
            <p className="mt-3 font-semibold">{t}</p>
            <p className="mt-2 text-sm leading-relaxed text-ui-muted">{b}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link href="/how-it-works" className="btn-primary">
          How it works
        </Link>
        <Link href="/contact" className="btn-ghost">
          Contact us
        </Link>
      </div>
    </main>
  );
}
