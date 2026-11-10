/**
 * HTTP end-to-end check for the team portal. Run against a live server with a migrated database
 * that already contains one administrator (see `npm run team:create-admin`).
 *
 *   ADMIN_NAME='Asha Rao' ADMIN_PHONE=+919812345678 ADMIN_PASSWORD='...' BASE_URL=http://localhost:3000 node scripts/team-smoke.mjs
 *
 * It creates three test members, then checks sign-in, directory visibility, KYC privacy, photo and
 * attachment access, private and group chat isolation, group removal and deactivation.
 * Test members are left in place with a timestamped name so runs do not collide.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME;
if (!ADMIN_PHONE || !ADMIN_PASSWORD || !ADMIN_NAME) {
  console.error('Set ADMIN_NAME, ADMIN_PHONE and ADMIN_PASSWORD.');
  process.exit(1);
}

const stamp = Date.now().toString().slice(-7);
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}

class Session {
  constructor(label) {
    this.label = label;
    this.cookie = null;
  }
  async req(method, path, { json, form, headers = {} } = {}) {
    const h = { Origin: BASE, ...headers };
    if (this.cookie) h.Cookie = this.cookie;
    let body;
    if (json !== undefined) {
      h['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      body = form;
    }
    const res = await fetch(`${BASE}${path}`, { method, headers: h, body, redirect: 'manual' });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      if (c.startsWith('tp_session=')) {
        const value = c.split(';')[0];
        this.cookie = value.endsWith('=') ? null : value;
      }
    }
    const contentType = res.headers.get('content-type') ?? '';
    let data = null;
    if (contentType.includes('application/json')) data = await res.json().catch(() => null);
    else data = await res.arrayBuffer();
    return { status: res.status, data, headers: res.headers };
  }
}

// Minimal valid file fixtures (magic bytes are what the server checks).
const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 0x20)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const fake = Buffer.from('MZ-this-is-an-executable-disguised-as-a-pdf'.padEnd(64, '.'));

function fileForm(fields, name, bytes, type) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append('file', new Blob([bytes], { type }), name);
  return fd;
}

async function main() {
  const admin = new Session('admin');
  const bala = new Session('bala');
  const carol = new Session('carol');

  // ----- Authentication -----
  let r = await admin.req('POST', '/api/team/auth/login', { json: { name: ADMIN_NAME, phone: ADMIN_PHONE, password: 'wrong-password-here' } });
  check('wrong password is rejected with 401', r.status === 401, `got ${r.status}`);

  r = await admin.req('POST', '/api/team/auth/login', { json: { name: ADMIN_NAME, phone: ADMIN_PHONE, password: ADMIN_PASSWORD } });
  r = await admin.req('POST', '/api/team/auth/login', { json: { name: 'Someone Else', phone: ADMIN_PHONE, password: ADMIN_PASSWORD } });
  check('right phone and password but wrong name is rejected', r.status === 401, `got ${r.status}`);
  r = await admin.req('POST', '/api/team/auth/login', { json: { name: ADMIN_NAME, phone: ADMIN_PHONE, password: ADMIN_PASSWORD } });
  check('admin signs in', r.status === 200 && admin.cookie, `got ${r.status}`);
  check('admin is flagged as administrator', r.data?.data?.isAdmin === true);

  r = await admin.req('POST', '/api/team/members', {
    json: { fullName: `Bala Test ${stamp}`, phone: `+9198${stamp}0`, password: 'bala-password-1', jobTitle: 'Engineer' },
  });
  const balaId = r.data?.data?.member?.id;
  check('admin creates a member', r.status === 201 && !!balaId, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await admin.req('POST', '/api/team/members', {
    json: { fullName: `Carol Test ${stamp}`, phone: `+9197${stamp}1`, password: 'carol-password-1', jobTitle: 'Designer' },
  });
  const carolId = r.data?.data?.member?.id;
  check('admin creates a second member', r.status === 201 && !!carolId, `got ${r.status}`);

  r = await admin.req('POST', '/api/team/members', {
    json: { fullName: 'Duplicate Phone', phone: `+9198${stamp}0`, password: 'another-password-1' },
  });
  check('duplicate phone number is refused', r.status === 409, `got ${r.status}`);

  r = await bala.req('POST', '/api/team/auth/login', { json: { name: `Bala Test ${stamp}`, phone: `+9198${stamp}0`, password: 'bala-password-1' } });
  check('new member signs in with phone + password', r.status === 200 && !!bala.cookie, `got ${r.status}`);

  r = await carol.req('POST', '/api/team/auth/login', { json: { name: `Carol Test ${stamp}`, phone: `+9197${stamp}1`, password: 'carol-password-1' } });
  check('second member signs in', r.status === 200 && !!carol.cookie, `got ${r.status}`);

  r = await new Session('anon').req('GET', '/api/team/members');
  check('directory requires sign-in', r.status === 401, `got ${r.status}`);

  r = await bala.req('POST', '/api/team/members', { json: { fullName: 'Hacker', phone: '+919000000001', password: 'hacker-password' } });
  check('a member cannot create members', r.status === 403, `got ${r.status}`);

  r = await admin.req('POST', '/api/team/members', { json: { fullName: 'x' }, headers: { Origin: 'https://evil.example' } });
  check('cross-origin write is blocked', r.status === 403, `got ${r.status}`);

  // ----- Directory and profiles -----
  r = await bala.req('GET', '/api/team/members');
  const names = (r.data?.data?.members ?? []).map((m) => m.id);
  check('directory lists active members (with phone) to members', r.status === 200 && names.includes(carolId) && names.includes(balaId));
  const balaCard = (r.data?.data?.members ?? []).find((m) => m.id === balaId);
  check('directory includes contact phone and KYC status', !!balaCard?.phone && balaCard?.kycStatus === 'PENDING');

  // ----- KYC privacy and upload validation -----
  r = await admin.req('POST', `/api/team/members/${balaId}/documents`, { form: fileForm({ label: 'AADHAAR' }, 'aadhaar.pdf', pdf, 'application/pdf') });
  const docId = r.data?.data?.id;
  check('admin uploads a KYC document', r.status === 201 && !!docId, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await admin.req('POST', `/api/team/members/${balaId}/documents`, { form: fileForm({ label: 'PAN' }, 'pan.pdf', fake, 'application/pdf') });
  check('file with a fake PDF extension is rejected', r.status === 400, `got ${r.status}`);

  r = await bala.req('GET', `/api/team/files/${docId}`);
  check('member can download their own KYC document', r.status === 200, `got ${r.status}`);
  check('KYC download is not cacheable', (r.headers.get('cache-control') ?? '').includes('no-store'));

  r = await carol.req('GET', `/api/team/files/${docId}`);
  check("other members cannot open someone else's KYC document (404)", r.status === 404, `got ${r.status}`);

  r = await carol.req('GET', `/api/team/members/${balaId}/documents`);
  check("other members cannot list someone else's KYC documents", r.status === 404, `got ${r.status}`);

  r = await carol.req('GET', `/api/team/members/${balaId}`);
  check('profile hides KYC list from other members', r.status === 200 && r.data?.data?.documents === null, `got ${r.status}`);

  // ----- Photo -----
  r = await admin.req('POST', `/api/team/members/${balaId}/photo`, { form: fileForm({}, 'bala.png', png, 'image/png') });
  const photoUrl = r.data?.data?.photoUrl;
  check('admin uploads a profile photo', r.status === 201 && !!photoUrl, `got ${r.status}`);
  r = await carol.req('GET', photoUrl ?? '/api/team/files/none');
  check('any active member can view a profile photo', r.status === 200, `got ${r.status}`);

  r = await admin.req('PATCH', `/api/team/members/${balaId}`, { json: { kycStatus: 'VERIFIED' } });
  check('admin marks KYC verified', r.status === 200, `got ${r.status}`);
  r = await carol.req('PATCH', `/api/team/members/${balaId}`, { json: { kycStatus: 'VERIFIED' } });
  check('member cannot change KYC status', r.status === 403, `got ${r.status}`);

  // ----- Private chat -----
  r = await bala.req('POST', '/api/team/conversations', { json: { memberId: carolId } });
  const convoId = r.data?.data?.id;
  check('member opens a private chat with another member', r.status === 201 && !!convoId, `got ${r.status}`);

  r = await carol.req('POST', '/api/team/conversations', { json: { memberId: balaId } });
  check('the same conversation is returned to the other person', r.data?.data?.id === convoId);

  r = await bala.req('POST', `/api/team/conversations/${convoId}/messages`, { json: { body: 'Hello Carol' } });
  check('private message is sent', r.status === 201, `got ${r.status}`);

  r = await carol.req('GET', `/api/team/conversations/${convoId}/messages`);
  check('recipient receives the message', r.status === 200 && r.data?.data?.messages?.some((m) => m.body === 'Hello Carol'));

  const convoList = await carol.req('GET', '/api/team/conversations');
  const unread = convoList.data?.data?.conversations?.find((c) => c.id === convoId)?.unread;
  check('unread count shows for the recipient', unread === 1, `unread=${unread}`);
  await carol.req('POST', `/api/team/conversations/${convoId}/read`);
  const after = await carol.req('GET', '/api/team/conversations');
  check('unread count clears after reading', after.data?.data?.conversations?.find((c) => c.id === convoId)?.unread === 0);

  r = await carol.req('POST', `/api/team/conversations/${convoId}/messages`, {
    form: fileForm({ body: 'See attached' }, 'notes.pdf', pdf, 'application/pdf'),
  });
  const attachment = r.data?.data?.message?.file;
  check('chat attachment is sent with text', r.status === 201 && !!attachment?.url, `got ${r.status}`);
  r = await bala.req('GET', attachment?.url ?? '/api/team/files/none');
  check('participant can download the attachment', r.status === 200, `got ${r.status}`);

  r = await admin.req('GET', `/api/team/conversations/${convoId}/messages`);
  check('an administrator is not a participant and cannot read private chat (404)', r.status === 404, `got ${r.status}`);
  r = await admin.req('GET', attachment?.url ?? '/api/team/files/none');
  check('an administrator cannot download a private attachment (404)', r.status === 404, `got ${r.status}`);

  // ----- Group chat -----
  r = await bala.req('GET', '/api/team/group');
  check('group exists and member can see it', r.status === 200 && r.data?.data?.isMember === true, `got ${r.status}`);

  r = await bala.req('POST', '/api/team/group/messages', { json: { body: 'Good morning team' } });
  check('group message is sent', r.status === 201, `got ${r.status}`);
  r = await carol.req('GET', '/api/team/group/messages');
  check('group message reaches other members', r.data?.data?.messages?.some((m) => m.body === 'Good morning team'));

  r = await carol.req('POST', '/api/team/group/messages', { form: fileForm({}, 'plan.png', png, 'image/png') });
  const groupFile = r.data?.data?.message?.file;
  check('group image attachment is sent', r.status === 201 && groupFile?.isImage === true, `got ${r.status}`);
  r = await bala.req('GET', groupFile?.url ?? '/api/team/files/none');
  check('group attachment is visible to members', r.status === 200);

  r = await admin.req('POST', '/api/team/group/members', { json: { memberId: carolId, member: false } });
  check('admin removes a member from the group', r.status === 200, `got ${r.status}`);
  r = await carol.req('GET', '/api/team/group/messages');
  check('removed member can no longer read the group (404)', r.status === 404, `got ${r.status}`);
  r = await carol.req('GET', groupFile?.url ?? '/api/team/files/none');
  check('removed member cannot open group attachments (404)', r.status === 404, `got ${r.status}`);

  r = await admin.req('POST', '/api/team/group/members', { json: { memberId: carolId, member: true } });
  check('admin re-adds the member', r.status === 200);

  // ----- Deactivation -----
  r = await admin.req('PATCH', `/api/team/members/${balaId}`, { json: { active: false } });
  check('admin deactivates a member', r.status === 200, `got ${r.status}`);
  r = await bala.req('GET', '/api/team/auth/me');
  check('deactivated member loses their session immediately', r.status === 401, `got ${r.status}`);
  r = await bala.req('POST', '/api/team/auth/login', { json: { name: `Bala Test ${stamp}`, phone: `+9198${stamp}0`, password: 'bala-password-1' } });
  check('deactivated member cannot sign in', r.status === 401, `got ${r.status}`);

  r = await admin.req('GET', '/api/team/auth/me');
  check('admin session is unaffected by another member being deactivated', r.status === 200);

  // ----- Pages -----
  r = await new Session('anon').req('GET', '/team/chat');
  check('chat page redirects signed-out visitors to login', r.status === 307, `got ${r.status}`);
  r = await new Session('anon').req('GET', '/team/admin');
  check('admin page redirects signed-out visitors to login', r.status === 307, `got ${r.status}`);

  const ok = results.filter((x) => x.ok).length;
  console.log(`\n${ok}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
