import { LegalPage, LegalSection } from '@/components/site/legal';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="5 November 2026">
      <LegalSection title="What we collect">
        <p>Your name, mobile number, optional email, address, and the details you give us to request help or to verify your identity. When you donate, we record the amount, campaign and payment status. We do not store card numbers or UPI PINs; our payment provider handles those.</p>
      </LegalSection>
      <LegalSection title="Why we collect it">
        <p>To run the platform, verify requests before publication, prevent fraud, send you confirmations and OTPs, issue receipts and meet our legal obligations, including KYC and anti-money-laundering requirements.</p>
      </LegalSection>
      <LegalSection title="Consent and your rights">
        <p>We ask for consent before identity checks. Under the Digital Personal Data Protection Act, 2023, you may ask what we hold about you, ask us to correct it, withdraw consent where the law allows, and ask for erasure. Some records, such as donation and payment records, must be kept for longer.</p>
      </LegalSection>
      <LegalSection title="How we protect it">
        <p>Personal data and documents are encrypted. Bank account numbers are encrypted and never shown publicly. Documents are stored privately and opened only by authorised reviewers, and every access is logged. Aadhaar numbers are not stored by HelpTrust.</p>
      </LegalSection>
      <LegalSection title="Who we share with">
        <p>Service providers under contract: verification partners, our payment aggregator, SMS and email providers. We share only what each needs. We do not sell personal data.</p>
      </LegalSection>
      <LegalSection title="Public information">
        <p>Campaigns show a beneficiary&apos;s first name and last initial, the story, verified status and approved photos. Donors who choose anonymity are not named.</p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>Write to support@helptrust.in. Our grievance officer details will be published with the final policy.</p>
      </LegalSection>
    </LegalPage>
  );
}
