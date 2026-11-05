import crypto from 'node:crypto';

/**
 * Password hashing with scrypt (memory-hard, from Node's standard library).
 * Stored format: scrypt$N$r$p$salt$hash (base64). Parameters travel with the hash, so they can be raised later.
 */
const DEFAULTS = { N: 16384, r: 8, p: 1, keyLen: 64 };

function derive(password: string, salt: Buffer, N: number, r: number, p: number, keyLen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password.normalize('NFKC'), salt, keyLen, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const { N, r, p, keyLen } = DEFAULTS;
  const key = await derive(password, salt, N, r, p, keyLen);
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Spend comparable time for unknown accounts so response timing does not reveal which numbers exist.
    await derive(password, Buffer.alloc(16), DEFAULTS.N, DEFAULTS.r, DEFAULTS.p, DEFAULTS.keyLen).catch(() => undefined);
    return false;
  }
  const [alg, N, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await derive(password, Buffer.from(saltB64, 'base64'), Number(N), Number(r), Number(p), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
