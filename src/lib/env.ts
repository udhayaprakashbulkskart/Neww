import { z } from 'zod';

/**
 * Typed, validated environment. Secrets are required in production and fall back to
 * clearly-marked development values elsewhere so local setup stays friendly.
 * Nothing here is exposed to the browser.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().optional(),
  PII_HASH_PEPPER: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  FILE_SIGNING_SECRET: z.string().optional(),
  STORAGE_DIR: z.string().default('./storage/private'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  OTP_TTL_SECONDS: z.coerce.number().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().positive().default(5),
  SMS_PROVIDER: z.enum(['console', 'none']).default('console'),
  EMAIL_PROVIDER: z.enum(['console', 'none']).default('console'),
  WHATSAPP_PROVIDER: z.enum(['none']).default('none'),
  KYC_PROVIDER: z.enum(['mock']).default('mock'),
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  MOCK_PAYMENT_SECRET: z.string().optional(),
  DONATION_MIN_PAISE: z.coerce.number().int().positive().default(5000),
  DONATION_MAX_PAISE: z.coerce.number().int().positive().default(50_000_000),
  CAMPAIGN_MAX_REQUEST_PAISE: z.coerce.number().int().positive().default(990_000_000),
  FRAUD_DONATIONS_PER_HOUR_PER_IP: z.coerce.number().int().positive().default(25),
  // HelpTrust (donations, KYC, OTP delivery) launch guards. Set to "false" on deployments that only run
  // the team portal, which uses none of those providers. Defaults to "true", so HelpTrust is unchanged.
  HELPTRUST_ENABLED: z.enum(['true', 'false']).default('true'),
});

export type Env = z.infer<typeof schema> & {
  encryptionKey: Buffer;
  piiPepper: Buffer;
  sessionSecret: Uint8Array;
  fileSigningSecret: Buffer;
  isProduction: boolean;
};

const DEV_FALLBACK = {
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  PII_HASH_PEPPER: 'dev-only-pepper-do-not-use-in-production',
  SESSION_SECRET: 'dev-only-session-secret-do-not-use-in-production',
  FILE_SIGNING_SECRET: 'dev-only-file-secret-do-not-use-in-production',
};

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  const isProduction = parsed.APP_ENV === 'production' || parsed.NODE_ENV === 'production';

  const pick = (key: keyof typeof DEV_FALLBACK, value: string | undefined) => {
    if (value && value.length > 0) return value;
    if (isProduction) {
      throw new Error(`Missing required secret ${key}. Set it in the environment before starting in production.`);
    }
    return DEV_FALLBACK[key];
  };

  const encryptionKey = Buffer.from(pick('ENCRYPTION_KEY', parsed.ENCRYPTION_KEY), 'base64');
  if (encryptionKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key (openssl rand -base64 32).');
  }

  if (isProduction && parsed.HELPTRUST_ENABLED === 'true') {
    if (parsed.KYC_PROVIDER === 'mock') {
      throw new Error('KYC_PROVIDER=mock is not allowed in production. Configure an authorised KYC provider.');
    }
    if (parsed.PAYMENT_PROVIDER === 'mock') {
      throw new Error('PAYMENT_PROVIDER=mock is not allowed in production. Configure Razorpay credentials.');
    }
    if (parsed.SMS_PROVIDER === 'console' || parsed.EMAIL_PROVIDER === 'console') {
      throw new Error('Console messaging providers are not allowed in production.');
    }
  }

  cached = {
    ...parsed,
    encryptionKey,
    piiPepper: Buffer.from(pick('PII_HASH_PEPPER', parsed.PII_HASH_PEPPER)),
    sessionSecret: new TextEncoder().encode(pick('SESSION_SECRET', parsed.SESSION_SECRET)),
    fileSigningSecret: Buffer.from(pick('FILE_SIGNING_SECRET', parsed.FILE_SIGNING_SECRET)),
    isProduction,
  };
  return cached;
}

/** Test helper: forget the cached environment so tests can change process.env. */
export function resetEnvCache() {
  cached = null;
}
