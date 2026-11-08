import { LegalPage, type LegalSection } from '@/components/legal/legal-page';

export const metadata = { title: 'Privacy policy - CrownTree' };

const sections: LegalSection[] = [
  { id: 'data', title: '1. What we collect', body: [
    'Account details: name, email address, and optionally a mobile number. Your password is stored only as a salted hash, never as readable text.',
    'Activity: orders, cashback, commissions, ad views, partner-offer clicks, withdrawals and wallet movements. We keep these as a financial record.',
    'Verification details: identity and bank details submitted for withdrawals, which are handled by our verification and finance teams.',
    'Technical data: IP address, device and browser type, and the pages you use, for security and fraud prevention.',
  ] },
  { id: 'use', title: '2. How we use it', body: [
    'To run your account, process orders and rewards, prevent fraud, meet tax and financial record-keeping duties, respond to support requests, and improve the service.',
    'We do not sell your personal data.',
  ] },
  { id: 'sharing', title: '3. Who we share it with', body: [
    'Merchants and partners receive only what is needed to fulfil an order or to track a partner click. Payment processors, verification providers and hosting providers act on our instructions under contracts. We may disclose data where the law requires it.',
  ] },
  { id: 'security', title: '4. Security', body: [
    'Passwords are hashed. Sessions use secure, httpOnly cookies. Payment confirmations are verified with signatures. Financial records are append-only. No system is perfectly secure, so please use a strong, unique password.',
  ] },
  { id: 'retention', title: '5. How long we keep data', body: [
    'We keep financial records for as long as the law requires for accounting and tax. Other account data is kept while your account is active and for a limited period after you close it, unless the law requires longer. [Retention periods to be confirmed by counsel.]',
  ] },
  { id: 'rights', title: '6. Your rights', body: [
    'You can ask to see, correct or delete your personal data, and withdraw consent where we rely on it. Some records must be kept even after a request. Contact the Grievance Officer to make a request. We will respond within the time required by law.',
  ] },
  { id: 'children', title: '7. Children', body: [
    'CrownTree is not intended for anyone under 18. We do not knowingly collect data from children.',
  ] },
  { id: 'updates', title: '8. Changes to this policy', body: [
    'We will tell you about material changes in the app or by email before they take effect.',
  ] },
];

export default function Privacy() {
  return <LegalPage current="/privacy" title="Privacy policy" intro="This policy explains what personal data CrownTree collects, why we need it, who we share it with, and the choices you have." sections={sections} />;
}
