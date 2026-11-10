import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { errors } from '../http';
import { keyedHash } from '../crypto';

const scryptAsync = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/**
 * Canonical phone: "+" followed by digits. A 10-digit number without a country code is treated as
 * an Indian mobile (+91), matching the rest of the platform.
 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw errors.badRequest('Enter a valid phone number, including the country code.');
  }
  if (!trimmed.startsWith('+') && digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export function phoneHash(canonical: string): string {
  return keyedHash(canonical, 'team-phone');
}

export function phoneLast4(canonical: string): string {
  return canonical.slice(-4);
}

/** Compare a typed name with the stored one: case, extra spaces and punctuation are ignored. */
export function namesMatch(typed: string, stored: string): boolean {
  const norm = (v: string) => v.normalize('NFKD').replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
  return norm(typed) !== '' && norm(typed) === norm(stored);
}

export function assertPasswordPolicy(password: string) {
  if (password.length < 10) throw errors.badRequest('Password must be at least 10 characters.');
  if (password.length > 128) throw errors.badRequest('Password must be 128 characters or fewer.');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** A precomputed hash used to keep sign-in timing flat when the phone number is unknown. */
let dummyHashPromise: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHashPromise;
}

export type TeamFileType = 'pdf' | 'jpeg' | 'png' | 'webp';

export const TEAM_MIME: Record<TeamFileType, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Decide the real file type from its magic bytes. The browser-declared type is never trusted. */
export function sniffTeamFile(buf: Buffer): TeamFileType | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export function isImageMime(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp';
}

/** Filenames are shown back to users, so strip anything that could be used for path or header tricks. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.replace(/[^\w.\- ()]/g, '_').slice(0, 120).trim();
  return cleaned || 'file';
}
