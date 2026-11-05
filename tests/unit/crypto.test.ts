import { describe, expect, it } from 'vitest';
import { decryptBytes, decryptText, encryptBytes, encryptText, keyedHash, signFileUrl, verifyFileSignature, verifyHmacSha256, randomDigits, sha256Hex, timingSafeEqualHex } from '@/lib/crypto';
import crypto from 'node:crypto';

describe('encryption at rest', () => {
  it('round-trips text and never returns the plaintext in the ciphertext', () => {
    const cipher = encryptText('9876543210');
    expect(cipher).not.toContain('9876543210');
    expect(decryptText(cipher)).toBe('9876543210');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptText('same')).not.toBe(encryptText('same'));
  });

  it('rejects tampered ciphertext (GCM authentication)', () => {
    const raw = Buffer.from(encryptText('secret'), 'base64');
    raw[raw.length - 1] ^= 0x01;
    expect(() => decryptText(raw.toString('base64'))).toThrow();
  });

  it('round-trips binary documents', () => {
    const data = crypto.randomBytes(4096);
    expect(decryptBytes(encryptBytes(data)).equals(data)).toBe(true);
  });
});

describe('keyed hashing', () => {
  it('is deterministic for the same purpose and value', () => {
    expect(keyedHash('9876543210', 'mobile')).toBe(keyedHash('9876543210', 'mobile'));
  });

  it('separates purposes so the same value hashes differently per domain', () => {
    expect(keyedHash('9876543210', 'mobile')).not.toBe(keyedHash('9876543210', 'email'));
  });

  it('produces hex SHA-256 sized output', () => {
    expect(keyedHash('x', 'mobile')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('signatures', () => {
  it('verifies a valid HMAC and rejects a modified payload', () => {
    const secret = 'whsec_test';
    const body = JSON.stringify({ event: 'payment.captured', amount: 100 });
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyHmacSha256(body, secret, sig)).toBe(true);
    expect(verifyHmacSha256(body.replace('100', '999'), secret, sig)).toBe(false);
    expect(verifyHmacSha256(body, 'wrong-secret', sig)).toBe(false);
  });

  it('rejects malformed signatures without throwing', () => {
    expect(verifyHmacSha256('x', 'k', 'not-hex')).toBe(false);
    expect(verifyHmacSha256('x', 'k', '')).toBe(false);
  });

  it('timing-safe hex comparison refuses empty or mismatched lengths', () => {
    expect(timingSafeEqualHex('', '')).toBe(false);
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false);
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
  });

  it('signed file URLs validate until they expire and reject tampering', () => {
    const id = 'cldocument00000000000001';
    const future = Math.floor(Date.now() / 1000) + 300;
    const sig = signFileUrl(id, future);
    expect(verifyFileSignature(id, future, sig)).toBe(true);
    expect(verifyFileSignature('other-id', future, sig)).toBe(false);
    expect(verifyFileSignature(id, future + 1, sig)).toBe(false);
    const past = Math.floor(Date.now() / 1000) - 5;
    expect(verifyFileSignature(id, past, signFileUrl(id, past))).toBe(false);
  });
});

describe('random codes', () => {
  it('generates digit-only codes of the requested length', () => {
    for (let i = 0; i < 50; i++) expect(randomDigits(6)).toMatch(/^\d{6}$/);
  });
});
