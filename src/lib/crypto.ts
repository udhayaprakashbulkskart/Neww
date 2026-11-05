import crypto from 'node:crypto';
import { env } from './env';

/**
 * Cryptographic helpers.
 * - AES-256-GCM for personal data and private documents at rest.
 * - Keyed HMAC for lookups (mobile, email, bank account) so plaintext is never indexed.
 * - HMAC-signed, time-limited URLs for private file downloads.
 */

const ALGO = 'aes-256-gcm';

/** Encrypt UTF-8 text. Output format: base64(iv[12] | tag[16] | ciphertext). */
export function encryptText(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, env().encryptionKey, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptText(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 29) throw new Error('Ciphertext too short');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, env().encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptBytes(data: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, env().encryptionKey, iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

export function decryptBytes(payload: Buffer): Buffer {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const decipher = crypto.createDecipheriv(ALGO, env().encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
}

/** Keyed hash for lookups. Normalise input before calling (e.g. digits-only mobile). */
export function keyedHash(value: string, purpose: string): string {
  return crypto.createHmac('sha256', env().piiPepper).update(`${purpose}:${value}`).digest('hex');
}

export function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Cryptographically secure numeric code with uniform distribution. */
export function randomDigits(length: number): string {
  let out = '';
  while (out.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < 250) out += String(byte % 10);
  }
  return out;
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Verify a hex HMAC-SHA256 signature of `payload` using `secret` in constant time. */
export function verifyHmacSha256(payload: string | Buffer, secret: string, signatureHex: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return timingSafeEqualHex(expected, signatureHex.toLowerCase());
}

/** Signed, expiring download token for a private file. */
export function signFileUrl(documentId: string, expiresAtSeconds: number): string {
  const sig = crypto
    .createHmac('sha256', env().fileSigningSecret)
    .update(`${documentId}.${expiresAtSeconds}`)
    .digest('base64url');
  return sig;
}

export function verifyFileSignature(documentId: string, expiresAtSeconds: number, sig: string): boolean {
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds < Math.floor(Date.now() / 1000)) return false;
  const expected = signFileUrl(documentId, expiresAtSeconds);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Mask a mobile number for logs and UI: +91 98XXX XX210 -> ******210 */
export function maskLast4(value: string): string {
  return value.slice(-4);
}
