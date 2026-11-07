// SMS delivery adapter. Development prints to the server console. Production needs a real provider.
import { getConfig } from './config';

export async function deliverSms(phone: string, message: string): Promise<void> {
  const cfg = getConfig();
  if (cfg.smsProvider === 'console') {
    // Dev only: never log the code in production (console provider is refused there).
    const masked = phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
    console.info(`[sms:dev] to ${masked}: ${message}`);
    return;
  }
  throw new Error(`SMS provider "${cfg.smsProvider}" is not configured in this build`);
}
