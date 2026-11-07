import Link from 'next/link';
import { PLANS, TIERS } from '@/lib/domain/plans';
import { formatMoney } from '@/lib/domain/money';
import { MembershipCard } from '@/components/membership-card';
import { Disclaimer } from '@/components/ui';

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="label">Retail-led membership platform</p>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Shop smarter. <span className="gold-text">Grow together.</span>
          </h1>
          <p className="max-w-xl text-[#bdb4a0]">
            BinaryPro rewards real retail. Earn cashback from merchants, commissions on verified sales from your
            binary team, and rewards for watching advertiser videos. Every rupee is funded, traceable and audited.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-brand">Join BinaryPro</Link>
            <Link href="/compliance" className="btn btn-ghost">How we stay compliant</Link>
          </div>
          <Disclaimer />
        </div>
        <div className="flex justify-center">
          <div className="relative w-full max-w-md">
            <div className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.25),transparent_60%)] blur-2xl" />
            <div className="relative space-y-4">
              <MembershipCard tier="PLATINUM" name="Your Name" active expires={null} />
              <MembershipCard tier="GOLD" name="Your Name" active expires={null} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-extrabold">Membership plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div key={t} className="panel flex flex-col gap-4 p-5">
              <div className="text-sm font-bold uppercase tracking-widest text-[#f7e09a]">{t}</div>
              <div className="text-2xl font-extrabold">
                {PLANS[t].priceInrMinor === 0n ? 'Free' : formatMoney(PLANS[t].priceInrMinor, 'INR')}
                <span className="text-sm font-medium text-[#a39a86]"> / year</span>
              </div>
              <ul className="space-y-2 text-sm text-[#cfc6b0]">
                <li>Direct commission on verified sales: {PLANS[t].directBps / 100}%</li>
                <li>Binary matching: {PLANS[t].binaryBps ? `${PLANS[t].binaryBps / 100}% of matched volume` : 'not included'}</li>
                <li>Daily ad rewards: up to {PLANS[t].adViewsPerDay} videos</li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Cashback', 'Merchant-funded offers of 10, 20, 30 or 50 percent, capped and paid only once the order is verified.'],
          ['Binary team', 'Place each new member on your left or right. Matched volume earns binary commission within daily limits.'],
          ['Advertising rewards', 'Watch approved sponsored videos in full. Rewards come only from advertiser budgets.'],
        ].map(([title, body]) => (
          <div key={title} className="panel p-6">
            <h3 className="text-lg font-bold text-[#f7e09a]">{title}</h3>
            <p className="mt-2 text-sm text-[#bdb4a0]">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
