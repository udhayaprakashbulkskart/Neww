#!/usr/bin/env node
/**
 * HTTP end-to-end smoke test for a running DEVELOPMENT server.
 *
 *   npm run dev -- -p 3000 > dev.log 2>&1 &
 *   HT_DEV_LOG=dev.log node scripts/e2e-smoke.mjs
 *
 * It drives the real flows: password sign-in, campaign wizard, document upload, verification, admin review,
 * sandbox donation, signed webhook, refund, signed file download, CSV export and page rendering.
 * Seeded demo accounts use DemoPassword1 (run `npm run db:seed` against the target database first).
 */
import { readFileSync, existsSync } from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.HT_BASE ?? 'http://localhost:3000';
const LOG = process.env.HT_DEV_LOG ?? 'dev.log';
const ORIGIN = BASE;
const MOCK_SECRET = process.env.MOCK_PAYMENT_SECRET ?? 'dev-only-mock-payment-secret';
const FILE_SECRET = process.env.FILE_SIGNING_SECRET ?? 'dev-only-file-secret-do-not-use-in-production';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Minimal cookie jar: keeps the session cookie a response sets. */
class Session {
  constructor(label) {
    this.label = label;
    this.cookie = '';
  }
  async call(method, path, { json, form, headers = {}, origin = true } = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (origin && method !== 'GET') h.origin = ORIGIN;
    let body;
    if (form) body = form;
    else if (json !== undefined) {
      h['content-type'] = 'application/json';
      body = JSON.stringify(json);
    }
    const res = await fetch(`${BASE}${path}`, { method, headers: h, body, redirect: 'manual', signal: AbortSignal.timeout(120_000) });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const m = /^ht_session=([^;]*)/.exec(c);
      if (m) this.cookie = m[1] ? `ht_session=${m[1]}` : '';
    }
    const type = res.headers.get('content-type') ?? '';
    const buf = Buffer.from(await res.arrayBuffer());
    let data = null;
    if (type.includes('application/json')) {
      try {
        data = JSON.parse(buf.toString('utf8'));
      } catch {
        data = null;
      }
    }
    return { status: res.status, headers: res.headers, data, text: buf.toString('utf8'), buf };
  }
}

const DEMO_PASSWORD = 'DemoPassword1';

/** Signs in a seeded demo account with mobile and password. */
async function signIn(mobile) {
  const s = new Session(mobile);
  const res = await s.call('POST', '/api/auth/login', { json: { mobile, password: DEMO_PASSWORD } });
  if (res.status !== 200) throw new Error(`login failed ${res.status}: ${res.text}`);
  return s;
}

/** A new 10-digit Indian mobile per run, so repeated runs never collide with earlier registrations. */
function freshMobile() {
  return `9${String(crypto.randomInt(100_000_000, 999_999_999))}`;
}

const donorMobileGuess = freshMobile();

function pdf(extra = '') {
  return Buffer.from(`%PDF-1.7\n% HelpTrust test document ${extra}\n%%EOF\n`);
}

function signedPath(docId, ttl = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = crypto.createHmac('sha256', FILE_SECRET).update(`${docId}.${exp}`).digest('base64url');
  return `/api/files/${docId}?exp=${exp}&sig=${sig}`;
}

function webhookSig(body) {
  return crypto.createHmac('sha256', MOCK_SECRET).update(body).digest('hex');
}

async function main() {
  console.log(`HelpTrust E2E smoke against ${BASE}\n`);

  console.log('Public site and security headers');
  const home = await new Session('anon').call('GET', '/');
  check('home renders', home.status === 200 && home.text.includes('Verified Help'));
  check('security headers set', home.headers.get('x-frame-options') === 'DENY' && home.headers.get('x-content-type-options') === 'nosniff');
  check('CSP forbids object embeds', (home.headers.get('content-security-policy') ?? '').includes("object-src 'none'"));
  for (const p of ['/how-it-works', '/explore', '/request-help', '/support-a-cause', '/about', '/faq', '/contact', '/privacy', '/terms', '/refund-policy']) {
    const r = await new Session('anon').call('GET', p);
    check(`page ${p}`, r.status === 200, `status ${r.status}`);
  }
  const demo = await new Session('anon').call('GET', '/api/public/campaigns/demo-help-clear-shop-loan');
  check('public campaign API returns a verified live campaign', demo.status === 200 && demo.data?.data?.status === 'PUBLISHED');
  const publicBody = JSON.stringify(demo.data ?? {});
  const keyNames = [...publicBody.matchAll(/"([A-Za-z_]+)":/g)].map((m) => m[1]);
  check('public campaign API exposes no personal or document identifiers (key names)', !keyNames.some((k) => /mobile|accountNumber|storageKey|sha256|providerRef|email|aadhaar/i.test(k)));
  check('beneficiary shown by first name and last initial', publicBody.includes('"Murugan R."'));

  console.log('\nGuest-visible mobile screens');
  for (const p of ['/app', '/app/onboarding', '/app/login', '/app/register', '/app/explore', '/app/campaign/demo-help-clear-shop-loan', '/app/category/medical']) {
    const r = await new Session('anon').call('GET', p);
    check(`guest can open ${p}`, r.status === 200, `status ${r.status}`);
  }

  console.log('\nAuthentication and access control');
  const anon = new Session('anon');
  const gated = await anon.call('GET', '/app/home');
  check('protected app page redirects to login', gated.status === 307 && (gated.headers.get('location') ?? '').includes('/app/login'));
  const adminGate = await anon.call('GET', '/admin');
  check('admin redirects to admin login', adminGate.status === 307 && (adminGate.headers.get('location') ?? '').includes('/admin/login'));
  const noAuthCreate = await anon.call('POST', '/api/campaigns', { json: {} });
  check('creating a campaign needs a session (401)', noAuthCreate.status === 401);
  const csrf = await anon.call('POST', '/api/auth/login', { json: { mobile: '9999999999', password: 'x' }, headers: { origin: 'https://evil.example' }, origin: false });
  check('cross-site POST is blocked (CSRF)', csrf.status === 403);
  const badMobile = await anon.call('POST', '/api/auth/login', { json: { mobile: '12345', password: 'x' } });
  check('invalid mobile gets a validation error', badMobile.status === 400 && badMobile.data?.error?.code === 'VALIDATION_ERROR');

  // ---- Beneficiary registration and campaign wizard ----
  const benMobile = freshMobile();
  const ben = new Session('beneficiary');
  const reg = await ben.call('POST', '/api/auth/register', { json: { fullName: 'Selvi Murugesan', mobile: benMobile, password: 'Sunshine42', consent: true } });
  check('registration creates the account and sets a session cookie', reg.status === 201 && ben.cookie.startsWith('ht_session='));
  const again = await new Session('x').call('POST', '/api/auth/register', { json: { fullName: 'Selvi Murugesan', mobile: benMobile, password: 'Sunshine42', consent: true } });
  check('registering an existing number asks the user to log in (409)', again.status === 409);

  const me = await ben.call('GET', '/api/auth/me');
  check('session resolves to the new user', me.data?.data?.user?.fullName === 'Selvi Murugesan');
  const typeSet = await ben.call('PATCH', '/api/profile', { json: { userType: 'BENEFICIARY' } });
  check('user chooses beneficiary type', typeSet.status === 200);

  const lockedDash = await ben.call('GET', '/app/beneficiary');
  check('dashboard shows the paywall before payment', lockedDash.status === 200 && lockedDash.text.includes('Pay to open your dashboard'));
  const draft = await ben.call('POST', '/api/campaigns', { json: {} });
  const campaignId = draft.data?.data?.id;
  check('wizard creates a draft', draft.status === 201 && !!campaignId);

  const details = await ben.call('PATCH', `/api/campaigns/${campaignId}/step/details`, {
    json: {
      title: 'Help me repay my shop loan after the flood',
      categorySlug: 'business',
      story: 'The flood destroyed my provision shop stock and the loan instalments have been piling up. I want to reopen and repay the loan slowly while my children stay in school.',
      urgency: 'HIGH',
      endsInDays: 60,
    },
  });
  check('step 1 (details) saves', details.status === 200);

  const personal = await ben.call('PATCH', `/api/campaigns/${campaignId}/step/personal`, {
    json: { fullName: 'Selvi Murugesan', mobile: benMobile, addressLine: '5 Ponnagar Street', city: 'Salem', state: 'Tamil Nadu', pincode: '636001' },
  });
  check('step 2 (personal) saves when the mobile matches sign-in', personal.status === 200);
  const wrongMobile = await ben.call('PATCH', `/api/campaigns/${campaignId}/step/personal`, {
    json: { fullName: 'Selvi Murugesan', mobile: donorMobileGuess, addressLine: '5 Ponnagar Street', city: 'Salem', state: 'Tamil Nadu', pincode: '636001' },
  });
  check('step 2 refuses a different mobile number', wrongMobile.status === 400);

  const financial = await ben.call('PATCH', `/api/campaigns/${campaignId}/step/financial`, {
    json: { totalDebtPaise: 2_000_000, paidPaise: 500_000, requestedPaise: 1_200_000 },
  });
  check('step 3 (financial) saves', financial.status === 200 && financial.data?.data?.remainingPaise === 1_500_000);
  const overAsk = await ben.call('PATCH', `/api/campaigns/${campaignId}/step/financial`, {
    json: { totalDebtPaise: 2_000_000, paidPaise: 500_000, requestedPaise: 1_600_001 },
  });
  check('financial step refuses a request above the remaining balance', overAsk.status === 400);

  const up = async (kind, bytes, type, name) => {
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', new Blob([bytes], { type }), name);
    return ben.call('POST', `/api/campaigns/${campaignId}/documents`, { form });
  };
  const idUp = await up('IDENTITY', pdf('id'), 'application/pdf', 'id.pdf');
  const addrUp = await up('ADDRESS', pdf('addr'), 'application/pdf', 'address.pdf');
  const loanUp = await up('LOAN_STATEMENT', pdf('loan'), 'application/pdf', 'loan.pdf');
  check('documents upload with valid content', idUp.status === 201 && addrUp.status === 201 && loanUp.status === 201);
  const spoof = await up('IDENTITY', Buffer.from('MZ\x90\x00 executable pretending to be a document padding'), 'application/pdf', 'invoice.pdf');
  check('an executable disguised as a PDF is rejected', spoof.status === 400);
  const liar = await up('ADDRESS', Buffer.from('\x89PNG\r\n\x1a\n' + 'x'.repeat(40)), 'application/pdf', 'picture.pdf');
  check('declared type must match file content', liar.status === 400);

  const idDocId = idUp.data?.data?.id;
  const verIdentity = await ben.call('POST', '/api/verifications/identity', { json: { consent: true } });
  check('identity check runs with consent', verIdentity.status === 200 && verIdentity.data?.data?.status === 'VERIFIED');
  const noConsent = await ben.call('POST', '/api/verifications/identity', { json: {} });
  check('identity check refuses without consent', noConsent.status === 400);
  const verAddress = await ben.call('POST', '/api/verifications/address', { json: {} });
  check('address check runs', verAddress.status === 200 && verAddress.data?.data?.status === 'VERIFIED');
  const bank = await ben.call('POST', '/api/verifications/bank', {
    json: { accountHolderName: 'Selvi Murugesan', accountNumber: '123456789123', confirmAccountNumber: '123456789123', ifscCode: 'HDFC0001234', bankName: 'HDFC Bank' },
  });
  check('bank account verified and stored masked', bank.status === 201 && bank.data?.data?.accountLast4 === '9123');
  const bankView = await ben.call('GET', '/api/verifications');
  check('bank view never returns the full account number', !JSON.stringify(bankView.data).includes('123456789123') && JSON.stringify(bankView.data).includes('XXXXXX9123'));

  const checklist = await ben.call('GET', `/api/campaigns/${campaignId}/checklist`);
  check('submission checklist is complete', checklist.data?.data?.complete === true, JSON.stringify(checklist.data?.data?.items?.filter((i) => !i.ok)));
  const submitBlocked = await ben.call('POST', `/api/campaigns/${campaignId}/submit`, { json: {} });
  check('posting is refused until the Rs 100 post fee is paid (402)', submitBlocked.status === 402);
  const feeOrder = await ben.call('POST', '/api/billing/post-fee', { json: {} });
  check('post fee order is created for Rs 100', feeOrder.status === 201 && feeOrder.data?.data?.amountPaise === 10000);
  const feePaid = await ben.call('POST', `/api/billing/post-fee/${feeOrder.data?.data?.postFeeId}/simulate`, { json: {} });
  check('post fee is credited only through the signed webhook', feePaid.status === 200 && feePaid.data?.data?.received === true);
  const feeStatus = await ben.call('GET', '/api/billing/status');
  check('paid post fee opens the dashboard and reserves one credit', feeStatus.data?.data?.hasDashboardAccess === true && feeStatus.data?.data?.availableCredits === 1);
  const submit = await ben.call('POST', `/api/campaigns/${campaignId}/submit`, { json: {} });
  check('campaign submits for review (PENDING)', submit.status === 200 && submit.data?.data?.status === 'PENDING');
  const lockedEdit = await ben.call('PATCH', `/api/campaigns/${campaignId}/step/details`, { json: { title: 'Changed after submission', categorySlug: 'business', story: 'x'.repeat(120), urgency: 'LOW', endsInDays: 30 } });
  check('submitted campaign cannot be edited', lockedEdit.status === 422);

  const ownerView = await ben.call('GET', `/api/campaigns/${campaignId}`);
  const docs = ownerView.data?.data?.documents ?? [];
  check('owner sees their documents without storage keys', docs.length === 3 && !JSON.stringify(docs).includes('storageKey'));

  // ---- Staff review ----
  console.log('\nStaff review and publication');
  const admin = await signIn('9000000001');
  check('super admin signs in with password', !!admin.cookie);
  const overview = await admin.call('GET', '/api/admin/overview');
  check('admin overview returns live figures', overview.status === 200 && typeof overview.data?.data?.totalUsers === 'number');
  const adminPage = await admin.call('GET', '/admin');
  check('admin overview page renders', adminPage.status === 200 && adminPage.text.includes('Needs attention'));

  const start = await admin.call('POST', `/api/admin/campaigns/${campaignId}/review`, { json: { action: 'START_REVIEW' } });
  check('review starts', start.status === 200 && start.data?.data?.status === 'UNDER_REVIEW');
  const earlyApprove = await admin.call('POST', `/api/admin/campaigns/${campaignId}/review`, { json: { action: 'APPROVE' } });
  check('approval is blocked while documents are unreviewed', earlyApprove.status === 422);
  for (const d of docs) {
    const r = await admin.call('POST', `/api/admin/documents/${d.id}/review`, { json: { decision: 'APPROVED' } });
    if (r.status !== 200) check(`approve document ${d.kind}`, false, r.text);
  }
  const approve = await admin.call('POST', `/api/admin/campaigns/${campaignId}/review`, { json: { action: 'APPROVE' } });
  check('campaign approves once everything is verified', approve.status === 200 && approve.data?.data?.status === 'APPROVED', approve.text);
  const publish = await admin.call('POST', `/api/admin/campaigns/${campaignId}/review`, { json: { action: 'PUBLISH' } });
  check('campaign publishes', publish.status === 200 && publish.data?.data?.status === 'PUBLISHED');

  const slugRes = await new Session('anon').call('GET', `/api/campaigns?q=shop%20loan&sort=latest`);
  check('discovery search finds the new live campaign', slugRes.status === 200 && JSON.stringify(slugRes.data).includes('Help me repay my shop loan'));
  const detail = await new Session('anon').call('GET', `/api/public/campaigns/${ownerView.data.data.slug}`);
  check('public page shows the approved campaign', detail.status === 200 && detail.data?.data?.status === 'PUBLISHED');

  const supportPage = await admin.call('GET', `/admin/campaigns/${campaignId}`);
  check('admin campaign review page renders', supportPage.status === 200);

  // ---- Donor and payments ----
  console.log('\nDonations, webhook and refunds');
  const donorMobile = freshMobile();
  const donor = new Session('donor');
  const reg2 = await donor.call('POST', '/api/auth/register', { json: { fullName: 'Arun Prakash', mobile: donorMobile, password: 'Harbour11', consent: true } });
  check('donor registers', reg2.status === 201);
  check('donor registers and signs in', !!donor.cookie);

  const slug = ownerView.data.data.slug;
  const raisedBefore = (await new Session('anon').call('GET', `/api/public/campaigns/${slug}`)).data?.data?.raisedPaise ?? 0;
  const idem = `don_${crypto.randomBytes(6).toString('hex')}`;
  const order = await donor.call('POST', '/api/donations', { json: { campaignId, amountPaise: 50_000, isAnonymous: false, idempotencyKey: idem } });
  check('donation creates a pending order', order.status === 201 && order.data?.data?.status === 'PENDING' && /^order_mock_/.test(order.data?.data?.orderId ?? ''));
  const again2 = await donor.call('POST', '/api/donations', { json: { campaignId, amountPaise: 50_000, isAnonymous: false, idempotencyKey: idem } });
  check('retrying the same donation does not create a second order', again2.data?.data?.donationId === order.data?.data?.donationId);
  const tiny = await donor.call('POST', '/api/donations', { json: { campaignId, amountPaise: 100, isAnonymous: false, idempotencyKey: `don_${crypto.randomBytes(6).toString('hex')}` } });
  check('donation below the minimum is refused', tiny.status === 400);
  const donationId = order.data?.data?.donationId;

  const sim = await donor.call('POST', `/api/donations/${donationId}/simulate`, { json: { outcome: 'success' } });
  check('sandbox payment completes through the signed webhook', sim.status === 200 && sim.data?.data?.received === true, sim.text);
  const settled = await donor.call('GET', `/api/donations/${donationId}`);
  check('donation becomes SUCCESS only after webhook', settled.data?.data?.status === 'SUCCESS' && /^HT\d{4}-/.test(settled.data?.data?.receiptNumber ?? ''));

  const publicAfter = await new Session('anon').call('GET', `/api/public/campaigns/${slug}`);
  check('campaign total rises by exactly the confirmed donation', publicAfter.data?.data?.raisedPaise === raisedBefore + 50_000, `${raisedBefore} -> ${publicAfter.data?.data?.raisedPaise}`);

  const receipt = await donor.call('GET', `/api/donations/${donationId}/receipt`);
  check('receipt renders and makes no tax claim', receipt.status === 200 && receipt.text.includes('does not claim any tax deduction'));

  const unsigned = await new Session('anon').call('POST', '/api/webhooks/razorpay', { json: { event: 'payment.captured' }, origin: false, headers: { 'content-type': 'application/json' } });
  check('webhook without signature is rejected', unsigned.status === 400);
  const forgedBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_forged', order_id: 'order_none', amount: 1 } } } });
  const forged = await new Session('anon').call('POST', '/api/webhooks/razorpay', { form: forgedBody, headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'ab'.repeat(32) }, origin: false });
  check('webhook with a forged signature is rejected', forged.status === 400);

  const refundReq = await donor.call('POST', `/api/donations/${donationId}/refund`, { json: { reason: 'Donated twice by mistake.' } });
  check('donor requests a refund within the window', refundReq.status === 201);
  const refundsAdmin = await admin.call('GET', '/admin/refunds');
  check('refund queue page renders', refundsAdmin.status === 200);

  const finance = await signIn('9000000003');
  const refund = await refundIdFor(finance, donationId);
  const decide = await finance.call('POST', `/api/admin/refunds/${refund}/decide`, { json: { decision: 'APPROVE', note: 'Duplicate donation confirmed.' } });
  check('finance approves and sends the refund', decide.status === 200 && decide.data?.data?.status === 'PROCESSED', decide.text);
  const refunded = await donor.call('GET', `/api/donations/${donationId}`);
  check('donation shows as refunded', refunded.data?.data?.status === 'REFUNDED');

  const csv = await finance.call('GET', '/api/admin/export?type=donations');
  check('finance exports donations as CSV', csv.status === 200 && (csv.headers.get('content-type') ?? '').includes('text/csv') && csv.text.startsWith('"donation_id"'));
  const csvAdminOnly = await donor.call('GET', '/api/admin/export?type=donations');
  check('donors cannot export', csvAdminOnly.status === 403 || csvAdminOnly.status === 401);

  console.log('\nDocuments, privacy and access');
  const fileOk = await new Session('anon').call('GET', signedPath(idDocId));
  check('signed link serves the document as an attachment', fileOk.status === 200 && fileOk.buf.equals(pdf('id')) && (fileOk.headers.get('content-disposition') ?? '').startsWith('attachment'));
  const fileNoSig = await new Session('anon').call('GET', `/api/files/${idDocId}`);
  check('document without a signature or session is denied', fileNoSig.status === 403);
  const fileTampered = await new Session('anon').call('GET', signedPath(idDocId).replace(/sig=[^&]+/, 'sig=AAAA'));
  check('tampered signature is denied', fileTampered.status === 403);
  const otherDonor = await donor.call('GET', `/api/files/${idDocId}`);
  check('another user cannot read a beneficiary document by session', otherDonor.status === 403);
  const publicDoc = await new Session('anon').call('GET', `/api/media/${idDocId}`);
  check('private documents are never public', publicDoc.status === 404);

  const donorAdmin = await donor.call('GET', '/api/admin/overview');
  check('donor cannot read admin data', donorAdmin.status === 403);
  const donorAdminPage = await donor.call('GET', '/admin');
  check('donor is redirected away from admin pages', donorAdminPage.status === 307 && (donorAdminPage.headers.get('location') ?? '').includes('forbidden'));

  console.log('\nPage rendering (signed-in views)');
  const pages = [
    [ben, '/app/home'], [ben, '/app/explore'], [ben, '/app/create'], [ben, `/app/create/${campaignId}/details`], [ben, `/app/create/${campaignId}/review`],
    [ben, `/app/status/${campaignId}`], [ben, `/app/status/${campaignId}/pending`], [ben, `/app/status/${campaignId}/approved`], [ben, '/app/beneficiary'], [ben, '/app/saved'], [ben, '/app/notifications'], [ben, '/app/settings'], [ben, '/app/help'],
    [donor, '/app/donor'], [donor, '/app/history'], [donor, `/app/donation/${donationId}`], [donor, `/app/donate/success/${donationId}`], [donor, `/app/donate/failed/${donationId}`],
    [donor, `/app/campaign/${slug}`], [donor, `/app/donate/${slug}`], [donor, '/app/user-type'],
    [admin, '/admin/users'], [admin, '/admin/beneficiaries'], [admin, '/admin/donors'], [admin, '/admin/campaigns'], [admin, '/admin/verifications'], [admin, '/admin/documents'], [admin, '/admin/donations'], [admin, '/admin/payments'], [admin, '/admin/refunds'], [admin, '/admin/fraud'], [admin, '/admin/complaints'], [admin, '/admin/analytics'], [admin, '/admin/staff'], [admin, '/admin/settings'],
    [finance, '/admin/analytics'], [finance, '/admin/refunds'],
  ];
  for (const [who, path] of pages) {
    const r = await who.call('GET', path);
    const ok = r.status === 200 || (/\/app\/status\/[^/]+$/.test(path) && r.status === 307);
    check(`page ${path} (${who.label})`, ok, `status ${r.status}`);
  }
  const hiddenNav = await finance.call('GET', '/admin/settings');
  check('finance cannot open settings (page redirects to login)', hiddenNav.status === 307);
  const scriptErr = (readFileSync(LOG, 'utf8').match(/Unhandled|TypeError|ReferenceError/g) ?? []).length;
  check('no unhandled server errors in the dev log', scriptErr === 0, `${scriptErr} occurrences`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('Failed:\n - ' + failures.join('\n - '));
    process.exitCode = 1;
  }
}

/** Looks up the refund created for a donation through the finance refund export. */
async function refundIdFor(finance, donationId) {
  const res = await finance.call('GET', '/api/admin/export?type=refunds');
  const lines = res.text.split('\n').slice(1).map((l) => l.replace(/"/g, '').split(','));
  const row = lines.find((cols) => cols[1] === donationId && cols[3] === 'REQUESTED');
  if (!row) throw new Error(`no requested refund found for donation ${donationId}`);
  return row[0];
}

main().catch((err) => {
  console.error('E2E aborted:', err);
  process.exitCode = 1;
});
