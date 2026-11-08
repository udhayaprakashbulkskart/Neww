import { LegalPage, type LegalSection } from '@/components/legal/legal-page';

export const metadata = { title: 'Refund and returns policy - CrownTree' };

const sections: LegalSection[] = [
  { id: 'returns', title: '1. Returns of merchant orders', body: [
    'Most merchant orders can be returned within the return window shown on the product or order. CrownTree’s own return window is 7 days after delivery, during which the order can be returned and the cashback and commission on it are reversed.',
    'After the return window, the order is final. Defective or wrongly delivered items are handled by the merchant under its own policy, and we will help you contact it.',
  ] },
  { id: 'refunds', title: '2. Refunds for orders', body: [
    'When an order is returned and accepted, the amount paid is refunded to your original payment method, or to your wallet if you choose. Refunds are normally completed within [number] working days of acceptance, subject to the time your bank takes to credit the amount.',
  ] },
  { id: 'membership', title: '3. Membership fees', body: [
    'Membership fees are paid for access to the platform for the plan term. You can cancel before any benefit has been used. [Refund window and proration rule to be confirmed by the business owner and counsel.] Fees are not refunded once a plan has been used for shopping, rewards or withdrawals, except where the law requires it.',
    'Plan changes mid-term are not offered. Upgrades take effect when paid.',
  ] },
  { id: 'rewards', title: '4. Reversals of rewards', body: [
    'If an order you earned commission or cashback on is returned, that commission and cashback are reversed. If the amount has already been withdrawn, it is recorded as a debt that must be repaid from your wallet.',
    'Advertising rewards that were credited correctly are not reversed, unless the view was found to be invalid.',
  ] },
  { id: 'withdrawals', title: '5. Withdrawal disputes', body: [
    'If a withdrawal is rejected by our finance team, the amount is returned to your wallet. If you believe a decision is wrong, contact support within [number] days with your reference number.',
  ] },
  { id: 'partners', title: '6. Partner purchases', body: [
    'Refunds on partner-offer purchases are handled by the partner. CrownTree is not a party to that sale and cannot issue refunds for it.',
  ] },
  { id: 'how', title: '7. How to request a refund or return', body: [
    'Open your order in the Shop page and choose Request return, or contact support with your order number. We will confirm the request by email or in the app.',
  ] },
];

export default function Refund() {
  return <LegalPage current="/refund" title="Refund and returns policy" intro="This policy explains how returns, refunds, membership fee refunds and reversals of commission and cashback work." sections={sections} />;
}
