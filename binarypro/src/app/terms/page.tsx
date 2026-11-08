import { LegalPage, type LegalSection } from '@/components/legal/legal-page';

export const metadata = { title: 'Terms and conditions - CrownTree' };

const sections: LegalSection[] = [
  { id: 'accounts', title: '1. Accounts', body: [
    'You must be at least 18 years old and able to enter a binding contract to use CrownTree. You sign in with an email address and password. You are responsible for keeping your password secret and for activity on your account.',
    'We may suspend or close an account that breaks these terms, is used for fraud, or is used to create false sales or false team activity.',
  ] },
  { id: 'membership', title: '2. Membership plans', body: [
    'Membership gives access to the shop, partner offers and ad rewards according to the plan you hold. Plans are Basic, Silver, Gold and Platinum. Each plan sets a cap on cashback coupons, daily ad-reward limits and binary limits. Prices and caps are shown before you pay.',
    'Membership fees are payment for access to the platform. They are not commission, and they never count toward any commission, binary volume or reward.',
  ] },
  { id: 'earnings', title: '3. How rewards are earned', body: [
    'Direct commission is paid only on retail orders that were paid, delivered and passed the return window, and only for orders placed by members you sponsored. Binary commission is paid only on matched volume from such verified retail orders, within your plan’s daily limit and only while funds are available in the commission reserve.',
    'Cashback is paid only from a funded merchant or promotional budget. Advertising rewards are paid only from an advertiser’s funded budget, and only after you watch at least 95% of the video.',
    'Rewards are not guaranteed. Results depend on your own verified sales and activity, and on the funds available. Nothing on CrownTree is a promise of income.',
  ] },
  { id: 'shopping', title: '4. Shopping and partner offers', body: [
    'Merchant orders are sold by the merchant named on the product. Partner offers open the partner’s own website. Your contract for a partner purchase is with that partner. CrownTree does not pay cashback on partner purchases.',
    'Coupon codes have the conditions shown on the coupon, including minimum order value, validity and per-member limits. A coupon can be withdrawn if it was issued in error or misused.',
  ] },
  { id: 'wallet', title: '5. Wallet and withdrawals', body: [
    'Balances are held in multiple currencies. Conversions use the published rate plus a spread shown before you confirm. Withdrawals require identity verification, a minimum amount, and approval by our finance team. We may hold a withdrawal while we investigate suspected fraud.',
    'If a commission or cashback is reversed because an order was returned, the amount is taken back from your wallet. If your wallet does not hold enough, the shortfall is recorded as a debt that you must repay.',
  ] },
  { id: 'conduct', title: '6. Conduct and fraud', body: [
    'You must not create false orders, self-referral loops, multiple accounts to gain rewards, fake ad views or false team information. We check for these patterns and may withhold rewards while we review them.',
  ] },
  { id: 'changes', title: '7. Changes and governing law', body: [
    'We may change these terms with notice in the app or by email. Continued use after the change means you accept it. These terms are governed by the laws of India, and courts at [city, state] have jurisdiction, subject to any mandatory consumer rights you have.',
  ] },
];

export default function Terms() {
  return <LegalPage current="/terms" title="Terms and conditions" intro="These terms explain how CrownTree works, what you agree to when you use it, and how rewards, withdrawals and disputes are handled." sections={sections} />;
}
