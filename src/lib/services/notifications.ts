import type { NotificationType } from '@prisma/client';
import { db } from '../db';
import { sendEmail, sendSms, type SmsTemplate } from '../providers/messaging';

/**
 * In-app notifications, with email and SMS fan-out that respects the user's preferences.
 * Delivery failures never roll back the business action that triggered the notification.
 */
export async function notify(args: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  sms?: SmsTemplate;
}): Promise<void> {
  try {
    await db.notification.create({
      data: { userId: args.userId, type: args.type, title: args.title, body: args.body, link: args.link ?? null },
    });
    const user = await db.user.findUnique({
      where: { id: args.userId },
      select: {
        mobileLast4: true,
        emailEncrypted: true,
        profile: { select: { notifyEmail: true, notifySms: true } },
      },
    });
    if (!user) return;
    if (args.sms && user.profile?.notifySms !== false) {
      await sendSms(user.mobileLast4, args.sms, args.body).catch(() => undefined);
    }
    if (user.emailEncrypted && user.profile?.notifyEmail !== false) {
      const { decryptText } = await import('../crypto');
      const email = decryptText(user.emailEncrypted);
      await sendEmail(email, args.title, args.body).catch(() => undefined);
    }
  } catch (err) {
    console.error('[notify] delivery failed', err instanceof Error ? err.message : '');
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}
