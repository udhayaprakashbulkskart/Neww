// CrownTree help knowledge base. The support bot answers only from these entries. Keep answers factual:
// never promise income, never invent rules, and point to a human for anything not covered here.
export interface KbEntry { id: string; topic: string; keywords: string[]; answer: string; link?: string }

export const KB: KbEntry[] = [
  { id: 'signup', topic: 'Creating an account', keywords: ['sign up', 'signup', 'register', 'create account', 'join', 'new account'],
    answer: 'Choose "Create account", enter your name, email and a password of at least 10 characters with a letter and a number. You start on the Basic plan.', link: '/login?mode=register' },
  { id: 'login', topic: 'Signing in', keywords: ['login', 'log in', 'sign in', 'password', 'forgot password', 'locked'],
    answer: 'Sign in with your email and password. After five wrong attempts the account is locked for 15 minutes. Password reset is not in the app yet, so contact the support team if you cannot get in.', link: '/login' },
  { id: 'plans', topic: 'Membership plans', keywords: ['plan', 'membership', 'basic', 'silver', 'gold', 'platinum', 'upgrade', 'price', 'fee'],
    answer: 'There are four plans: Basic (free), Silver, Gold and Platinum. Each plan sets your cashback coupon cap (10%, 20%, 30% or 50%), your daily ad-reward limit and your binary limits. Membership fees are for access and are never paid out as commission.', link: '/#plans' },
  { id: 'cashback', topic: 'Cashback coupons', keywords: ['cashback', 'coupon', 'discount', 'promo', 'code', 'percent'],
    answer: 'Coupons are offered by merchants. Your plan sets the highest percentage you can use. Cashback is credited only after the order is delivered and the 7-day return window closes. If the order is returned, the cashback is reversed.', link: '/shop' },
  { id: 'partner', topic: 'Partner offers', keywords: ['partner', 'offer', 'deal', 'open offer'],
    answer: 'Partner offers open the partner\'s own website. You buy from the partner, not CrownTree, and CrownTree does not pay cashback on partner purchases. Some offers need a higher plan.', link: '/offers' },
  { id: 'orders', topic: 'Orders and delivery', keywords: ['order', 'delivery', 'shipping', 'track', 'delivered', 'status'],
    answer: 'You can see every order and its status on the Shop page. Your order is held until it is delivered and the 7-day return window ends. Delivery timing is set by the merchant.', link: '/shop' },
  { id: 'returns', topic: 'Returns and refunds', keywords: ['return', 'refund', 'money back', 'cancel', 'exchange'],
    answer: 'Merchant orders can be returned within the window shown on the order and our 7-day return window after delivery. Refunds are made to your original payment method or your wallet. Membership fee refunds follow the refund policy.', link: '/refund' },
  { id: 'wallet', topic: 'Wallet and balances', keywords: ['wallet', 'balance', 'currency', 'convert', 'exchange rate'],
    answer: 'Your wallet holds one balance per currency. You can convert between currencies at the published rate plus a 1.5% spread, shown before you confirm.', link: '/wallet' },
  { id: 'withdraw', topic: 'Withdrawals', keywords: ['withdraw', 'withdrawal', 'bank', 'payout', 'kyc', 'verify', 'verification', 'pending'],
    answer: 'To withdraw you need to complete identity verification, meet the minimum amount for the currency, and wait for finance approval. Only one withdrawal can be pending at a time. A rejected withdrawal returns to your wallet.', link: '/wallet' },
  { id: 'ads', topic: 'Watch and earn ads', keywords: ['ad', 'ads', 'video', 'watch', 'reward', 'earn'],
    answer: 'Watch a sponsored video in full (at least 95% of its length) to claim the reward. Rewards come from the advertiser\'s budget, one per campaign per day, within your plan\'s daily limit. Skipped videos earn nothing.', link: '/ads' },
  { id: 'binary', topic: 'Binary team', keywords: ['binary', 'tree', 'left', 'right', 'team', 'placement', 'place', 'downline'],
    answer: 'New members are placed in an open left or right position in their sponsor\'s team. Binary rewards come from matched volume on verified retail orders, within your plan limit and only while funds are available.', link: '/tree' },
  { id: 'earnings', topic: 'Earnings and commissions', keywords: ['earning', 'commission', 'direct', 'income', 'how much', 'money', 'profit'],
    answer: 'Commissions come only from verified retail sales: paid, delivered and past the return window. They never come from joining or membership fees. Results depend on your own activity. CrownTree does not guarantee any income.', link: '/earnings' },
  { id: 'app', topic: 'Installing the app', keywords: ['app', 'install', 'download', 'android', 'iphone', 'ios', 'home screen'],
    answer: 'CrownTree installs from your browser. On Android and desktop Chrome, use the Install button. On iPhone, open the site in Safari, tap Share, then Add to Home Screen.', link: '/install' },
  { id: 'data', topic: 'Privacy and data', keywords: ['privacy', 'data', 'delete', 'personal', 'information', 'gdpr'],
    answer: 'Read the privacy policy for what we collect and why. To ask about your data, use this chat and say "data request"; a team member will follow it up.', link: '/privacy' },
  { id: 'human', topic: 'Talk to a person', keywords: ['human', 'agent', 'person', 'real', 'support team', 'complaint', 'escalate', 'urgent'],
    answer: 'I can hand this to our support team. Describe the problem in one message, include your order or reference number if you have one, and say "escalate" to pass it on.' },
];

export const SAFE_FALLBACK = 'I could not find a clear answer to that. Try rephrasing, or say "talk to a person" and our support team will follow up.';
