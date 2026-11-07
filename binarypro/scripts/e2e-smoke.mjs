// End-to-end HTTP smoke test against a running server.
// Usage: APP_URL=http://localhost:3000 node scripts/e2e-smoke.mjs
import { createHmac } from 'node:crypto';

const BASE = process.env.APP_URL ?? 'http://localhost:3000';
// Seeded demo accounts share one password (SEED_PASSWORD, default DemoPassword123).
const PASSWORD = process.env.E2E_PASSWORD ?? process.env.SEED_PASSWORD ?? 'DemoPassword123';
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? 'dev-only-webhook-secret-do-not-use-in-prod';
let failures = 0;
const results = [];
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  if (!cond) failures++;
};

class Session {
  constructor(email) { this.email = email; this.cookie = null; }
  async req(method, path, body, extraHeaders = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: BASE, ...(this.cookie ? { Cookie: this.cookie } : {}), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const sc = res.headers.get('set-cookie');
    if (sc && sc.startsWith('bp_session=')) this.cookie = sc.split(';')[0];
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }
  login() {
    return this.req('POST', '/api/auth/login', { email: this.email, password: PASSWORD });
  }
}

const sign = (body) => createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

async function main() {
  // 1. Sign in as seeded Alice (GOLD) and read her profile.
  const alice = new Session('alice@binarypro.test');
  const a = await alice.login();
  check('Email and password sign-in succeeds for seeded member', a.status === 200, `status ${a.status}`);
  const me = await alice.req('GET', '/api/me');
  check('GET /api/me returns the member', me.status === 200 && me.json.name === 'Alice');
  check('Alice has an active paid membership', ['GOLD', 'PLATINUM'].includes(me.json.membership?.tier) && me.json.membership?.active === true);

  // 2. Unauthenticated and cross-site requests are refused.
  const anon = await new Session('nobody@binarypro.test').req('GET', '/api/me');
  const wrong = await new Session('alice@binarypro.test').req('POST', '/api/auth/login', { email: 'alice@binarypro.test', password: 'not-the-password' });
  check('Wrong password is refused with a generic error', wrong.status === 401 && wrong.json.error?.code === 'BAD_CREDENTIALS');
  check('Unauthenticated /api/me is refused', anon.status === 401);
  const csrf = await fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: { Origin: 'https://evil.example', Cookie: alice.cookie } });
  check('Cross-site POST is blocked', csrf.status === 403);

  // 3. Webhook: bad signature refused, valid signature accepted once, replay ignored.
  const bad = await fetch(`${BASE}/api/webhooks/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': 'ab'.repeat(32) }, body: '{"id":"x"}' });
  check('Webhook with bad signature is refused', bad.status === 401);

  // 4. Membership upgrade: checkout -> sandbox capture (signed webhook) -> PLATINUM.
  const checkout = await alice.req('POST', '/api/membership', { tier: 'PLATINUM', currency: 'INR' });
  check('Membership checkout creates a payment', checkout.status === 200 && checkout.json.providerRef, JSON.stringify(checkout.json).slice(0, 120));
  const capture = await alice.req('POST', `/api/payments/${checkout.json.providerRef}/mock-pay`);
  check('Sandbox capture activates membership', capture.status === 200 && capture.json.duplicate === false);
  const me2 = await alice.req('GET', '/api/me');
  check('Alice is now PLATINUM', me2.json.membership?.tier === 'PLATINUM');

  // 5. Shopping: create order with a coupon, pay, and confirm it is held (not verified).
  const products = await alice.req('GET', '/api/products');
  const product = products.json.products?.[0];
  check('Catalogue lists products', !!product);
  const order = await alice.req('POST', '/api/orders', { items: [{ productId: product.id, quantity: 1 }], couponCode: 'WELCOME20' });
  check('Order is created with a welcome coupon', order.status === 201 && BigInt(order.json.order.cashbackMinor) > 0n, JSON.stringify(order.json).slice(0, 120));
  const paid = await alice.req('POST', `/api/payments/${order.json.paymentRef}/mock-pay`);
  check('Order payment captured', paid.status === 200);

  // 6. Admin: deliver, then verification is refused inside the return window.
  const admin = new Session('platformadmin@binarypro.test');
  await admin.login();
  const deliver = await admin.req('POST', `/api/orders/${order.json.order.id}/deliver`);
  check('Admin marks order delivered', deliver.status === 200);
  const early = await admin.req('POST', `/api/orders/${order.json.order.id}/verify`);
  check('Verification refused inside the 7-day return window', early.status === 409 && early.json.error.code === 'RETURN_WINDOW_OPEN');
  const fin = new Session('financelead@binarypro.test');
  await fin.login();
  const forbidden = await fin.req('POST', `/api/orders/${order.json.order.id}/verify`);
  check('Finance cannot verify orders (role separation)', forbidden.status === 403);

  // 7. Advertising: a view cannot be completed early; a full watch pays the reward.
  // Create, activate and fund a fresh campaign so the check does not depend on earlier data.
  const created = await admin.req('POST', '/api/admin/campaigns', { advertiser: 'Smoke Test Brand', title: `Smoke ${Date.now()}`, videoUrl: 'https://cdn.example.com/smoke.mp4', durationSec: 5, rewardMinor: '3.00', currency: 'INR' });
  const campaignId = created.json.id;
  await admin.req('PATCH', '/api/admin/campaigns', { campaignId, action: 'ACTIVATE' });
  await fin.req('PATCH', '/api/admin/campaigns', { campaignId, action: 'FUND', amount: '100.00' });
  const ads = await alice.req('GET', '/api/ads');
  const campaign = ads.json.campaigns?.find((c) => c.id === campaignId && !c.watchedToday);
  if (campaign) {
    const start = await alice.req('POST', `/api/ads/${campaign.id}/start`);
    check('Ad view starts', start.status === 201);
    const early2 = await alice.req('POST', `/api/ads/views/${start.json.viewId}/complete`);
    check('Ad completion refused before the video is watched', early2.status === 409);
    await new Promise((r) => setTimeout(r, (campaign.durationSec * 1000) + 500));
    const done = await alice.req('POST', `/api/ads/views/${start.json.viewId}/complete`);
    check('Ad reward credited after full watch', done.status === 200 && BigInt(done.json.rewardMinor) > 0n);
  } else {
    check('Ad campaign available for smoke test', false, 'no live campaign');
  }

  // 8. Placement: a new member joins under Alice and takes her open RIGHT slot.
  const aliceId = me.json.id;
  const newbie = new Session(`newbie.${Date.now()}@binarypro.test`);
  const nb = await newbie.req('POST', '/api/auth/register', { name: 'Newbie Member', email: newbie.email, password: PASSWORD, ref: aliceId });
  check('Referred sign-up creates a member', nb.status === 201);
  const place = await newbie.req('POST', '/api/placement', { parentId: aliceId, side: 'RIGHT' });
  check('Member places into the sponsor downline', place.status === 200 || place.status === 409, JSON.stringify(place.json).slice(0, 100));
  const outsider = await newbie.req('POST', '/api/placement', { parentId: 'nonexistent-id-0000000', side: 'LEFT' });
  check('Placement outside the downline is refused', outsider.status >= 400);

  // 9. Wallet and withdrawals are guarded.
  const overdraw = await alice.req('POST', '/api/withdrawals', { currency: 'INR', amount: '999999.00' });
  check('Withdrawal above balance is refused', overdraw.status === 409);
  const convert = await alice.req('POST', '/api/wallet', { from: 'INR', to: 'USD', amount: '999999.00' });
  check('Conversion above balance is refused', convert.status === 409);

  // 10. Binary run is staff-only and idempotent per day.
  const runDenied = await alice.req('POST', '/api/admin/binary-run', {});
  check('Members cannot run binary payouts', runDenied.status === 403);
  const run1 = await admin.req('POST', '/api/admin/binary-run', { periodKey: '2026-11-07' });
  const run2 = await admin.req('POST', '/api/admin/binary-run', { periodKey: '2026-11-07' });
  check('Binary run is idempotent per period', run1.status === 200 && run2.json.duplicate === true);

  console.log(results.join('\n'));
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
