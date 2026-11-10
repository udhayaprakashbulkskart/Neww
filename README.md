# HelpTrust

**Real People. Real Problems. Verified Help.**

HelpTrust is a verified financial-assistance and crowdfunding platform for India. People facing genuine financial difficulty
can request help; every request is verified before it is published; donors give through an authorised payment provider and
every donation is confirmed by a signed server-side webhook.

Repository: `Neww` (branch `ccr-e8a20e07-sdl64k`).

---

## What is included

| Area | Delivered |
| --- | --- |
| Mobile app (31 screens) | `src/app/(mobile)/app/*`. Splash, onboarding, login, registration, OTP, user type, home, explore, category, campaign detail, 8-step campaign wizard, pending/approved status, donation selection, payment, success/failed, history, saved, notifications, beneficiary and donor dashboards, settings, help. Bottom navigation on tab roots. |
| Website (12 pages) | `src/app/(site)/*`. Home (live stats), About, How it works, Explore, Campaign details, Request help, Support a cause, Contact, FAQ, Privacy, Terms, Refund policy. |
| Admin dashboard | `src/app/(admin)/admin/*`. Desktop sidebar with all 15 sections, role-filtered. Campaign review, document review, verification queue, refunds, fraud, complaints, analytics and CSV exports, staff roles, settings, audit history. |
| Campaigns | Draft/save per step, submission checklist, state machine (`src/lib/state/campaign-machine.ts`), publication only after approval. |
| Verification | Mobile OTP, identity and address checks (consent-based, provider adapter), bank account verification with encrypted account numbers, document review, manual review queue. |
| Documents | Type checked by file signature (magic bytes), AES-256-GCM encrypted at rest, private storage outside `public/`, HMAC-signed 5-minute download links, public access only for approved photos/videos on live campaigns. |
| Donations | Idempotent order creation, Razorpay Checkout (or sandbox mock), checkout signature check, **webhook-only settlement** with signature over the raw body and event-id de-duplication, amount-mismatch hold, receipts (HTML, print to PDF), refund requests and finance approval. |
| Security | Session cookies (`httpOnly`, `SameSite=Lax`, signed JWT with session version for instant revocation), RBAC from database roles, CSRF origin check, rate limits on OTP and sign-in, security headers and CSP, Zod validation on every input, parameterised queries only (Prisma), audit log on every privileged or money-moving action. |
| Fraud monitoring | Rules for duplicate documents, duplicate campaigns, repeated campaign abuse, shared bank accounts, bank changes after submission, donation bursts and amount mismatches. Rules only raise reviewable flags; they never suspend anyone. |
| Database | PostgreSQL + Prisma. All tables from the brief plus `WebhookEvent`, `OtpCode`, `Verification` and the supporting enums. Migrations in `prisma/migrations`. |
| Tests | 91 unit and integration tests (`npm test`) and a 124-check HTTP end-to-end smoke test (`scripts/e2e-smoke.mjs`). |

---

## Quick start (local)

Requirements: Node 18.18+ (22 tested), PostgreSQL 14+.

```bash
npm install                      # also runs prisma generate
cp .env.example .env.local       # then set DATABASE_URL and DIRECT_URL
npx prisma migrate dev           # applies migrations to your database
npm run db:seed                  # development demo data (refuses to run in production)
npm run dev                      # http://localhost:3000
```

Development notes:

* OTP codes are printed to the server console (`[sms:dev] OTP for ******1234: 123456`). They are never returned in API responses.
* The payment provider defaults to `mock`: a local sandbox that uses the same signing and webhook code as Razorpay.
* Development falls back to clearly named dev-only secrets when `ENCRYPTION_KEY` and friends are unset. Production does not.

Demo sign-in numbers (seeded): staff `9000000001` (super admin), `9000000002` (verification), `9000000003` (finance),
`9000000004` (support), `9000000005` (fraud); beneficiaries `9100000001`–`9100000004`; donors `9200000001`–`9200000002`.

---

## Configuration

All configuration is in `.env.example`. Summary:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | App (pooled) and migration (direct) connection strings. |
| `ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM. Generate: `openssl rand -base64 32`. **Required in production.** |
| `PII_HASH_PEPPER`, `SESSION_SECRET`, `FILE_SIGNING_SECRET` | Keyed-hash pepper, JWT signing key and signed-URL key. **Required in production.** |
| `STORAGE_DIR` | Private document directory. Local disk in development only (see Deployment). |
| `PAYMENT_PROVIDER` | `mock` or `razorpay`. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay credentials. Use `rzp_test_` keys until legal approval and live onboarding are complete. |
| `KYC_PROVIDER` | `mock` only in development. Production refuses to start with `mock`. |
| `SMS_PROVIDER`, `EMAIL_PROVIDER` | `console` in development. Production refuses `console`. |

The app refuses to start in production (`APP_ENV=production` or `NODE_ENV=production`) if a secret is missing or if a
mock/console provider is configured. This is deliberate.

---

## Database

Any PostgreSQL 14+ works. Use a managed provider in production (for example Neon, Supabase, RDS or Azure Database for
PostgreSQL in the India region, Mumbai or Hyderabad, to keep personal data in India).

* Point `DATABASE_URL` at the pooled endpoint (serverless) and `DIRECT_URL` at the direct endpoint.
* Apply migrations on deploy: `npm run db:migrate` (`prisma migrate deploy`).
* Enable automated backups with point-in-time recovery, and test a restore before launch.
* Test database: `TEST_DATABASE_URL` defaults to `helptrust_test` on localhost. Run `DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL npx prisma migrate deploy` once before `npm test`.

---

## Testing

```bash
npm run typecheck     # TypeScript, strict mode
npm test              # unit + integration (needs the helptrust_test database migrated)
npm run build         # production build

npm run dev -- -p 3000 > dev.log 2>&1 &   # start the dev server, logging to dev.log
HT_DEV_LOG=dev.log node scripts/e2e-smoke.mjs   # HTTP end-to-end flow (124 checks)
```

Coverage by layer:

* **Unit:** encryption and signatures, validation schemas (money, IFSC, mobile, OTP), state machine, document sniffing,
  CSV injection guard, HTML escaping, formatting, rate limiter.
* **Integration (real database):** OTP lifecycle (single use, lockout, expiry, hashing), donation idempotency and limits,
  checkout signature forgery, webhook signature and tampering, replay de-duplication, amount mismatch hold, campaign
  review gates and permissions, suspension revocation, refunds applied exactly once.
* **HTTP end-to-end:** sign-up and sign-in, CSRF, wizard, uploads (spoofed and mismatched files rejected), verification,
  submission lock, review gates, publication, sandbox donation, forged and valid webhooks, refund, signed and tampered file
  links, CSV export permissions, every page rendered per role, and no unhandled server errors in the log.

Not yet covered by automation: mobile-device visual regression, load testing, third-party sandbox certification
(Razorpay test-mode end-to-end with real checkout), accessibility audit with assistive technology.

---

## Deployment (Vercel)

1. **Create the database** (see Database) and run `npm run db:migrate` against it once.
2. **Set environment variables** in Vercel Project Settings for the Production environment: everything in `.env.example`
   marked as required, with production values. Never use `NEXT_PUBLIC_` for secrets.
3. **Storage:** Vercel's filesystem is ephemeral, so `STORAGE_DIR` on local disk will not persist between requests.
   **Before production launch, implement the private object-storage adapter** (S3-compatible, private bucket, server-side
   encryption on top of the application encryption, no public ACL). The interface lives in
   `src/lib/services/documents.ts`, and the write and read paths are the two functions to replace.
4. **Payments:** in the Razorpay dashboard, add a webhook pointing at `https://<your-domain>/api/webhooks/razorpay` with
   the events `payment.captured`, `payment.failed` and `refund.processed`, and set the same secret as
   `RAZORPAY_WEBHOOK_SECRET`. Start in test mode with `rzp_test_` keys.
5. **Rate limiting:** the built-in limiter is per instance. For multi-instance production, back `src/lib/rate-limit.ts`
   with Redis (for example Upstash) using the same keys.
6. Deploy with `vercel --prod` or the Git integration. The build runs `prisma generate` first.

Not yet production-ready (must be completed before live donations):

* **KYC provider:** only the `mock` adapter exists. Integrate an authorised provider under contract (consent-based
   e-KYC through an AUA/KUA partner, and a licensed bank name-match or penny-drop API). `src/lib/providers/kyc.ts`.
* **SMS:** a DLT-registered sender and approved templates are required for transactional SMS in India. `src/lib/providers/messaging.ts`.
* **Email and WhatsApp:** approved transactional providers. Currently console-only.
* **Object storage** for documents (see step 3).
* **Legal review** of the Terms, Privacy Policy and Refund Policy. The pages carry a visible draft banner until counsel signs off.

---

## Legal and compliance position

HelpTrust is built with these obligations in mind; it is not a claim of compliance:

* **DPDP Act, 2023:** consent is captured at registration and before identity checks; data-subject requests are handled
  through support and an erasure workflow; personal data is minimised (for example, the Aadhaar number is never stored).
* **Payments:** card and UPI data never touch HelpTrust servers; payments run through an authorised payment aggregator.
  Operating a collection model requires a payment-aggregator arrangement and RBI-compliant settlement. This needs legal and
  payments-partner review before live donations.
* **KYC and AML:** identity and bank checks are built around an authorised provider. Suspicious-activity reporting and
  record retention need an internal policy and a designated compliance owner.
* **Fundraising and FCRA:** the platform is for domestic donations in INR. Foreign contributions are not accepted. Any
  change to that requires FCRA analysis.
* **Tax:** HelpTrust does **not** claim or provide any tax deduction to donors. Receipts state this explicitly.
* **Consumer protection:** refund policy, grievance contact and transparent campaign status are shown in the product.

---

## Architecture

```
src/
  app/
    (mobile)/app/...     mobile screens (route group, URL prefix /app)
    (site)/...           public website
    (admin)/admin/...    staff dashboard (each page enforces its own permission)
    api/...              REST routes: thin handlers, validation and services in src/lib
  components/
    ui/                  design primitives and icon set
    mobile/              app shell, bottom navigation, campaign cards, client forms
    browse/              shared campaign browser and campaign detail (app and website)
    wizard/              campaign creation steps
    admin/               admin shell, tables, review controls
  lib/
    auth/                sessions (JWT + DB session version), OTP
    services/            business logic: campaigns, donations, payment events, documents, verification, fraud, admin
    providers/           messaging, KYC, payment gateways (Razorpay, sandbox mock)
    state/               campaign lifecycle transitions
    validation/          Zod schemas shared by API routes and forms
    crypto.ts            AES-GCM, keyed hashes, HMAC verification, signed URLs
    rbac.ts              permissions and default roles
prisma/                  schema, migrations, seed
tests/                   unit and integration tests
scripts/e2e-smoke.mjs    HTTP end-to-end test against the running dev server
```

Money is stored in paise (`Int`) and capped per record at ₹99,00,000 so it fits in 32-bit columns.

---

## Known limitations

* **Photography:** the design uses gradient placeholders with beneficiary initials. Licensed, consent-based photography
  should be supplied per campaign and for the marketing pages.
* **Single-instance rate limiting and in-memory state** (see Deployment).
* **Notifications** are stored in-app and dispatched to console providers until real providers are configured.
* **Account erasure** is recorded as a request for the support team; automated erasure jobs are not yet built.
* **No ESLint configuration** is included; typechecking and tests run via `npm run typecheck` and `npm test`.

---

## Support

support@helptrust.in · Help is also available in the app under Help and support.

---

## Team Portal (`/team`)

A separate module in this app for company team members: a member directory with profiles, KYC status and documents,
one-to-one private chat, and a common **Team Group** chat. It reuses this app's database, encryption (AES-256-GCM),
session approach (signed JWT with instant revocation), rate limiting, audit log and CSRF checks.

| Area | Where |
| --- | --- |
| Sign-in (full name, phone and password; no self sign-up, accounts are added by an administrator) | `/team/login` · `POST /api/team/auth/login` |
| Directory (grid/list, search, Verified/Pending filter, Chat, View Profile) | `/team` |
| Member profile (photo, phone, KYC documents and status) | `/team/members/[id]` |
| Private chat (text, images, PDF, timestamps, unread counts) | `/team/chat`, `/team/chat/[id]` |
| Team Group (all active members, text and attachments) | `/team/group` |
| Administration (add/edit members, photos, KYC status and documents, activate/deactivate, group membership, password reset) | `/team/admin`, `/team/admin/members/[id]` |
| Own profile and password change | `/team/profile` |

Notes for this module:

* **Storage.** Photos, KYC documents and chat attachments are stored AES-256-GCM encrypted in the `TeamFile` table.
  This survives serverless deploys, where local disk does not persist. Uploads are limited to 4 MB, below the
  serverless request body limit. Only PDF, JPEG, PNG and WebP are accepted, identified by magic bytes.
* **Privacy.** KYC documents are visible only to the member and administrators. Private chat and attachments are
  visible only to the two participants. Non-participants receive 404, so file ids cannot be used to probe.
* **Real-time.** Messages arrive by polling every 2.5 seconds, which works on serverless hosting. Replacing it with a
  push channel (for example Neon Realtime or Pusher) needs no change to the data model.
* **Bootstrap the first administrator** (no portal account exists yet):
  `npm run team:create-admin -- --name "Full Name" --phone "+91XXXXXXXXXX" --password "at-least-10-chars"`
* **Smoke test** against a running server: `ADMIN_PHONE=... ADMIN_PASSWORD=... node scripts/team-smoke.mjs`.
* **Deployment flag.** HelpTrust's production launch guards (KYC/payment providers, SMS/email providers) refuse to
  start under `NODE_ENV=production` while those are mock or console providers. The team portal uses none of them, so
  a team-only deployment sets `HELPTRUST_ENABLED=false`. The default is `true`, so HelpTrust behaves exactly as before.
