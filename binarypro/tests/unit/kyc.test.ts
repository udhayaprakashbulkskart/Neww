import { describe, expect, it } from 'vitest';
import { documentError, normalisePhone, normaliseReferral, sniffDocument, validateAccountNumber, validateHolderName, validateIfsc } from '@/lib/domain/kyc';
import { decryptBytes, encryptBytes, sha256Hex } from '@/lib/server/crypto';

describe('sign-up validation', () => {
  it('normalises Indian mobile numbers', () => {
    expect(normalisePhone('9876543210')).toBe('+919876543210');
    expect(normalisePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalisePhone('09876543210')).toBe('+919876543210');
    expect(normalisePhone('5876543210')).toBeNull();
    expect(normalisePhone('12345')).toBeNull();
  });

  it('validates IFSC, account numbers and holder names', () => {
    expect(validateIfsc('sbin0001234')).toBe('SBIN0001234');
    expect(validateIfsc('SBI0001234')).toBeNull();
    expect(validateIfsc('SBIN1001234')).toBeNull();
    expect(validateAccountNumber('1234 5678 9012')).toBe('123456789012');
    expect(validateAccountNumber('12345678')).toBeNull();
    expect(validateAccountNumber('12345678901234567890')).toBeNull();
    expect(validateHolderName('  Asha   Kumar ')).toBe('Asha Kumar');
    expect(validateHolderName('A1')).toBeNull();
  });

  it('normalises referral numbers', () => {
    expect(normaliseReferral(' bp4f9a2c1d7e ')).toBe('BP4F9A2C1D7E');
  });
});

describe('documents', () => {
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(100)]);

  it('detects the real type from the file contents', () => {
    expect(sniffDocument(jpg)).toBe('image/jpeg');
    expect(sniffDocument(png)).toBe('image/png');
    expect(sniffDocument(pdf)).toBe('application/pdf');
    // An executable renamed to .jpg is refused.
    expect(sniffDocument(Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1'))).toBeNull();
  });

  it('refuses empty, oversized and unsupported files', () => {
    expect(documentError(Buffer.alloc(0), 'PAN')).toMatch(/empty/);
    expect(documentError(Buffer.concat([jpg, Buffer.alloc(6 * 1024 * 1024)]), 'PAN')).toMatch(/5 MB/);
    expect(documentError(Buffer.from('plain text file here'), 'PAN')).toMatch(/JPG, PNG or PDF/);
    expect(documentError(jpg, 'PAN')).toBeNull();
  });
});

describe('encryption at rest', () => {
  it('round-trips bytes and never stores the plaintext', () => {
    const plain = Buffer.from('ABCDE1234F-account-9876543210');
    const blob = encryptBytes(plain);
    expect(blob.includes(plain)).toBe(false);
    expect(decryptBytes(blob).equals(plain)).toBe(true);
    // Each encryption uses a fresh IV.
    expect(encryptBytes(plain).equals(blob)).toBe(false);
  });

  it('rejects tampered ciphertext', () => {
    const blob = encryptBytes(Buffer.from('secret'));
    blob[blob.length - 1] ^= 0x01;
    expect(() => decryptBytes(blob)).toThrow();
  });

  it('hashes content for integrity records', () => {
    expect(sha256Hex(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
