import { env } from '../env';

/**
 * Messaging adapters. Production must use DLT-registered SMS senders (TRAI requirement in India)
 * and an approved transactional email / WhatsApp Business provider. The console adapter only
 * exists for development and is rejected at startup in production (see env.ts).
 */

export type SmsTemplate = 'OTP' | 'DONATION_RECEIVED' | 'PAYMENT_CONFIRMATION' | 'CAMPAIGN_STATUS';

export async function sendOtpSms(mobileLast4: string, code: string, fullMobile: string): Promise<void> {
  const provider = env().SMS_PROVIDER;
  if (provider === 'console') {
    // Development only. The code is printed so local testers can complete the flow.
    console.info(`[sms:dev] OTP for ******${mobileLast4}: ${code}`);
    return;
  }
  void fullMobile;
  throw new Error('No SMS provider configured. Set SMS_PROVIDER to a DLT-registered provider adapter.');
}

export async function sendSms(mobileLast4: string, template: SmsTemplate, text: string): Promise<void> {
  if (env().SMS_PROVIDER === 'console') {
    console.info(`[sms:dev] ${template} to ******${mobileLast4}: ${text}`);
    return;
  }
  // Production adapters are wired here once the DLT template IDs are approved.
  console.warn(`[sms] provider not configured; skipped ${template}`);
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (env().EMAIL_PROVIDER === 'console') {
    const [name, domain] = to.split('@');
    console.info(`[email:dev] to ${name.slice(0, 2)}***@${domain}: ${subject}`);
    void body;
    return;
  }
  console.warn('[email] provider not configured; skipped');
}
