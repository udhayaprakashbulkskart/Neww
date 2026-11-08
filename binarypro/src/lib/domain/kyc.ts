// Sign-up validation for contact, payout and identity-document fields. Pure functions.

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Indian mobile number. Accepts 10 digits, with an optional +91 or 0 prefix. Returns +91XXXXXXXXXX. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '');
  const m = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digits);
  return m ? `+91${m[1]}` : null;
}

export function validateIfsc(input: string): string | null {
  const v = input.trim().toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? v : null;
}

export function validateAccountNumber(input: string): string | null {
  const v = input.replace(/\s/g, '');
  return /^\d{9,18}$/.test(v) ? v : null;
}

export function validateHolderName(input: string): string | null {
  const v = input.trim().replace(/\s+/g, ' ');
  return v.length >= 3 && v.length <= 80 && /^[A-Za-z][A-Za-z .'-]*$/.test(v) ? v : null;
}

export type DocumentMime = 'image/jpeg' | 'image/png' | 'application/pdf';

/** Identifies the real file type from its first bytes. The browser-supplied type is not trusted. */
export function sniffDocument(buf: Buffer): DocumentMime | null {
  if (buf.length < 8) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  return null;
}

export function documentError(buf: Buffer, label: string): string | null {
  if (buf.length === 0) return `${label} is empty`;
  if (buf.length > MAX_DOCUMENT_BYTES) return `${label} must be 5 MB or smaller`;
  if (!sniffDocument(buf)) return `${label} must be a JPG, PNG or PDF file`;
  return null;
}

/** Referral numbers are upper-case, 10 characters after the BP prefix, without look-alike characters. */
export function normaliseReferral(input: string): string {
  return input.trim().toUpperCase().replace(/\s/g, '');
}
