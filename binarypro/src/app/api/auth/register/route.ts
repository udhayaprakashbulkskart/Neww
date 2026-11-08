import { z } from 'zod';
import { registerMember, issueSession, setSessionCookie } from '@/lib/server/auth';
import { handle, ok, fail, assertSameOrigin } from '@/lib/server/http';
import { DomainError } from '@/lib/server/errors';
import { normalisePhone, normaliseReferral, validateAccountNumber, validateHolderName, validateIfsc, documentError, sniffDocument } from '@/lib/domain/kyc';

export const runtime = 'nodejs';

const Text = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().max(254),
  phone: z.string().trim().max(20),
  password: z.string().min(10).max(128),
  referral: z.string().trim().max(32),
  accountHolder: z.string().trim().max(120),
  bankName: z.string().trim().min(2).max(80),
  ifsc: z.string().trim().max(11),
  accountNumber: z.string().trim().max(30),
  accountNumberConfirm: z.string().trim().max(30),
  ref: z.string().max(64).optional().nullable(),
});

function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === 'string' ? v : '';
}

async function file(form: FormData, name: string): Promise<Buffer | null> {
  const v = form.get(name);
  if (!(v instanceof File) || v.size === 0) return null;
  return Buffer.from(await v.arrayBuffer());
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail('BAD_FORM', 'Send the sign-up form as multipart data', 400);
    }
    const raw = {
      name: field(form, 'name'),
      email: field(form, 'email'),
      phone: field(form, 'phone'),
      password: field(form, 'password'),
      referral: field(form, 'referral'),
      accountHolder: field(form, 'accountHolder'),
      bankName: field(form, 'bankName'),
      ifsc: field(form, 'ifsc'),
      accountNumber: field(form, 'accountNumber'),
      accountNumberConfirm: field(form, 'accountNumberConfirm'),
      ref: field(form, 'ref') || null,
    };
    const body = Text.parse(raw);

    const phone = normalisePhone(body.phone);
    if (!phone) throw new DomainError('INVALID_PHONE', 'Enter a valid 10-digit Indian mobile number', 422);
    const referral = normaliseReferral(body.referral);
    if (!referral) throw new DomainError('REFERRAL_REQUIRED', 'Enter the referral number of the member who invited you', 422);
    const holder = validateHolderName(body.accountHolder);
    if (!holder) throw new DomainError('INVALID_HOLDER', 'Enter the account holder name as printed on the bank account', 422);
    const ifsc = validateIfsc(body.ifsc);
    if (!ifsc) throw new DomainError('INVALID_IFSC', 'Enter a valid IFSC code, for example SBIN0001234', 422);
    const account = validateAccountNumber(body.accountNumber);
    if (!account) throw new DomainError('INVALID_ACCOUNT', 'Enter a bank account number of 9 to 18 digits', 422);
    if (validateAccountNumber(body.accountNumberConfirm) !== account) {
      throw new DomainError('ACCOUNT_MISMATCH', 'The two account numbers do not match', 422);
    }

    const aadhaar = await file(form, 'aadhaar');
    const pan = await file(form, 'pan');
    if (!aadhaar) throw new DomainError('DOCUMENTS_REQUIRED', 'Upload your Aadhaar document', 422);
    if (!pan) throw new DomainError('DOCUMENTS_REQUIRED', 'Upload your PAN card', 422);
    const aadhaarError = documentError(aadhaar, 'Aadhaar document');
    if (aadhaarError) throw new DomainError('INVALID_DOCUMENT', aadhaarError, 422);
    const panError = documentError(pan, 'PAN card');
    if (panError) throw new DomainError('INVALID_DOCUMENT', panError, 422);

    const user = await registerMember({
      name: body.name,
      email: body.email,
      password: body.password,
      phone,
      referralCode: referral,
      sponsorId: body.ref ?? null,
      bank: { accountHolder: holder, bankName: body.bankName, ifsc, accountNumber: account },
      documents: [
        { kind: 'AADHAAR', buffer: aadhaar, mime: sniffDocument(aadhaar)! },
        { kind: 'PAN', buffer: pan, mime: sniffDocument(pan)! },
      ],
    });
    await setSessionCookie(await issueSession(user.id, user.sessionVersion));
    return ok({ id: user.id, name: user.name, kyc: 'PENDING' }, 201);
  });
}
