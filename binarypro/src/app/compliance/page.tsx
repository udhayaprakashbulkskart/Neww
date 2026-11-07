import { Section } from '@/components/ui';
import { MIN_WITHDRAWAL, COMMISSION_FUNDING_BPS } from '@/lib/domain/plans';

export default function Compliance() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-black">Compliance, terms and privacy</h1>
      <Section title="How CrownTree earns and pays">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#cfc6b0]">
          <li>Commissions are paid only on verified, delivered retail sales that have passed their return window.</li>
          <li>There are no commissions for joining, for recruiting alone, or for membership fees.</li>
          <li>Each verified sale funds a commission reserve equal to {COMMISSION_FUNDING_BPS / 100}% of its value. Payouts cannot exceed that reserve.</li>
          <li>Cashback is funded only by the merchant or a promotional budget. A coupon can never pay more than its funded pool holds.</li>
          <li>Advertising rewards are funded only by advertiser deposits and are paid only after the full video is watched.</li>
          <li>No income is guaranteed. Results depend on your own sales and activity.</li>
        </ul>
      </Section>
      <Section title="Money handling">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#cfc6b0]">
          <li>Every balance movement is a balanced double-entry ledger transaction. Ledger history cannot be edited.</li>
          <li>Withdrawals need identity verification, a minimum of INR {MIN_WITHDRAWAL.INR / 100n} (or its equivalent), and finance approval.</li>
          <li>Returns reverse the commissions and cashback that were released. Money already withdrawn becomes a receivable.</li>
        </ul>
      </Section>
      <Section title="Legal review required" subtitle="Summary for the operator. Not legal advice.">
        <p className="text-sm leading-relaxed text-[#cfc6b0]">
          Before launch, obtain written advice on India&apos;s Direct Selling Guidelines (2016), the Prize Chits and
          Money Circulation Schemes (Banning) Act, 1978, GST on supplies and commissions, the Consumer Protection (E-Commerce)
          Rules, 2020, DPDP Act 2023 for personal data, and the equivalent rules in every country where CrownTree operates.
          Plan parameters in <code>src/lib/domain/plans.ts</code> are defaults and must be approved by the business owner
          and counsel.
        </p>
      </Section>
      <Section title="Privacy" subtitle="Summary">
        <p className="text-sm leading-relaxed text-[#cfc6b0]">
          We collect your mobile number, name and KYC details to run your account. OTP codes are stored only as keyed
          hashes and expire in five minutes. Sessions use httpOnly, same-site cookies.
        </p>
      </Section>
      <Section title="Terms" subtitle="Summary">
        <p className="text-sm leading-relaxed text-[#cfc6b0]">
          Accounts may be suspended for fraud, self-referral loops, or misuse. Commissions linked to a suspected
          breach are withheld for review. Disputes are handled by support before any reversal is posted.
        </p>
      </Section>
    </div>
  );
}
