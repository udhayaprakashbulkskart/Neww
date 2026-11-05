import { LegalPage, LegalSection } from '@/components/site/legal';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="5 November 2026">
      <LegalSection title="The platform">
        <p>HelpTrust connects people who need financial help with people who want to give it. HelpTrust is not a bank, lender or charity, and it does not offer any tax deduction to donors.</p>
      </LegalSection>
      <LegalSection title="Eligibility and accuracy">
        <p>You must be an adult and give true, complete information. A campaign must be for your own genuine need, in your own name. Knowingly false information can lead to removal, account suspension and reporting to the authorities.</p>
      </LegalSection>
      <LegalSection title="Verification">
        <p>Campaigns are published only after verification and review. Approval is not a guarantee that any amount will be raised or paid out.</p>
      </LegalSection>
      <LegalSection title="Donations">
        <p>Donations are made through our authorised payment aggregator. A donation is confirmed when the provider confirms the payment. Funds are used toward the approved campaign and paid to the verified beneficiary account.</p>
      </LegalSection>
      <LegalSection title="Refunds">
        <p>See the Refund Policy. Refunds are subject to review and may not be available once funds have been paid out.</p>
      </LegalSection>
      <LegalSection title="Conduct">
        <p>Do not post false, abusive or misleading content, impersonate anyone, or attempt to bypass verification or payments. We may suspend accounts where we have a reasonable, documented concern, and we review every case before we act.</p>
      </LegalSection>
      <LegalSection title="Liability">
        <p>HelpTrust provides the platform as it is and is not responsible for the conduct of users beyond what the law requires. Nothing here limits rights that cannot be limited under Indian law.</p>
      </LegalSection>
      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of India. Courts at the seat of HelpTrust&apos;s registered office have jurisdiction, subject to any consumer rights you have.</p>
      </LegalSection>
    </LegalPage>
  );
}
