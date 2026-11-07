// Runtime configuration. Validated lazily so `next build` works without secrets; production refuses to run
// with development secrets or mock/console providers.

let cached: AppConfig | null = null;

export interface AppConfig {
  isProd: boolean;
  appUrl: string;
  sessionSecret: string;
  otpPepper: string;
  webhookSecret: string;
  paymentProvider: string;
  smsProvider: string;
}

function secret(name: string, devFallback: string, isProd: boolean): string {
  const v = process.env[name];
  if (v && v.length >= 32) return v;
  if (isProd) throw new Error(`${name} must be set (at least 32 characters) in production`);
  return devFallback;
}

export function getConfig(): AppConfig {
  if (cached) return cached;
  // APP_ENV is authoritative when set; NODE_ENV is only the fallback so local `next start` works with APP_ENV=development.
  const explicit = process.env.APP_ENV;
  const isProd = explicit ? explicit === 'production' : process.env.NODE_ENV === 'production';
  const paymentProvider = process.env.PAYMENT_PROVIDER ?? 'mock';
  const smsProvider = process.env.SMS_PROVIDER ?? 'console';
  if (isProd && paymentProvider === 'mock') throw new Error('PAYMENT_PROVIDER=mock is not allowed in production');
  if (isProd && smsProvider === 'console') throw new Error('SMS_PROVIDER=console is not allowed in production');
  cached = {
    isProd,
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    sessionSecret: secret('SESSION_SECRET', 'dev-only-session-secret-do-not-use-in-prod', isProd),
    otpPepper: secret('OTP_PEPPER', 'dev-only-otp-pepper-do-not-use-in-prod', isProd),
    webhookSecret: secret('PAYMENT_WEBHOOK_SECRET', 'dev-only-webhook-secret-do-not-use-in-prod', isProd),
    paymentProvider,
    smsProvider,
  };
  return cached;
}
