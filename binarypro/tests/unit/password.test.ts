import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, passwordPolicyError } from '@/lib/server/password';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct-horse-42');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct-horse-42', hash)).toBe(true);
    expect(await verifyPassword('correct-horse-43', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    const a = await hashPassword('same-password-1');
    const b = await hashPassword('same-password-1');
    expect(a).not.toBe(b);
  });

  it('rejects malformed stored values', async () => {
    expect(await verifyPassword('x', 'plaintext')).toBe(false);
    expect(await verifyPassword('x', 'md5$abc$def')).toBe(false);
  });

  it('enforces the password policy', () => {
    expect(passwordPolicyError('short1')).toMatch(/at least 10/);
    expect(passwordPolicyError('allletters')).toMatch(/letter and a number/);
    expect(passwordPolicyError('goodpassword1')).toBeNull();
    expect(passwordPolicyError('a'.repeat(129) + '1')).toMatch(/at most 128/);
  });
});
