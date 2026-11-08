// Field and file encryption for identity documents and bank account numbers (AES-256-GCM).
// Layout of every ciphertext: iv (12 bytes) | auth tag (16 bytes) | encrypted data.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getConfig } from './config';

let key: Buffer | null = null;

function encryptionKey(): Buffer {
  if (key) return key;
  const raw = process.env.KYC_ENCRYPTION_KEY;
  if (raw) {
    const b = Buffer.from(raw, 'base64');
    if (b.length !== 32) throw new Error('KYC_ENCRYPTION_KEY must be 32 random bytes, base64 encoded');
    key = b;
    return b;
  }
  // Any hosted deployment refuses to run without a real key. APP_ENV is not trusted for this check,
  // because a deployment can be labelled otherwise. Only a plain local run uses the fixed dev key.
  if (process.env.VERCEL || getConfig().isProd || process.env.NODE_ENV === 'production') {
    throw new Error('KYC_ENCRYPTION_KEY must be set on every hosted deployment');
  }
  key = createHash('sha256').update('binarypro-dev-only-kyc-key').digest();
  return key;
}

export function encryptBytes(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptBytes(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const body = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
