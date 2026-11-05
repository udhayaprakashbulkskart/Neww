import Link from 'next/link';
import { homeSections } from '@/lib/services/campaigns';
import { Icon } from '@/components/ui/icons';
import { CampaignTile } from '@/components/mobile/campaign-card';

export const metadata = { title: 'Support a cause', description: 'Give to verified campaigns with a receipt and a refund option.' };

export default async function SupportPage() {
  const data = await homeSections();
  return (
    <main className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
      <p className="eyebrow">Support a cause</p>
      <h1 className="mt-4 text-balance text-[40px] font-extrabold leading-tight tracking-tight md:text-[52px]">Give to people you can see clearly.</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ui-muted">
        Every campaign here has been verified. Choose a cause, give what you can from ₹100, and receive a receipt for every donation.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/explore" className="btn-primary">
          Browse campaigns
          <Icon name="arrowRight" className="h-5 w-5" />
        </Link>
        <Link href="/refund-policy" className="btn-ghost">
          Refund policy
        </Link>
      </div>

      <ul className="mt-14 grid gap-4 md:grid-cols-3">
        {[
          ['Verified before listing', 'We check identity, address, bank account and bills before any campaign appears here.'],
          ['Choose your visibility', 'Give with your first name shown, or anonymously. Your receipt always carries your details.'],
          ['Refund if you need to', 'Request a full refund within 7 days of a successful payment.'],
        ].map(([t, b]) => (
          <li key={t} className="surface-flat p-6">
            <p className="font-semibold">{t}</p>
            <p className="mt-2 text-sm leading-relaxed text-ui-muted">{b}</p>
          </li>
        ))}
      </ul>

      {data.verified.length > 0 && (
        <section className="mt-20" aria-labelledby="sup-h">
          <h2 id="sup-h" className="mb-6 text-[24px] font-bold">
            Campaigns that need support now
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data.verified.slice(0, 8).map((c) => (
              <CampaignTile key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-16 max-w-2xl text-xs leading-relaxed text-ui-subtle">
        HelpTrust does not provide tax deductions or tax receipts under any section of the Income-tax Act. Your receipt confirms your payment only. Please consult your tax adviser about your own position.
      </p>
    </main>
  );
}
