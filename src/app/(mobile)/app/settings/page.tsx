import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { getProfile } from '@/lib/services/profile';
import { TopBar } from '@/components/mobile/shell';
import { SettingsForm } from '@/components/mobile/forms/settings-form';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requirePageUser('/app/settings');
  const p = await getProfile(user.id);
  return (
    <main className="pb-12">
      <TopBar back="/app/donor" title="Settings" />
      <div className="space-y-8 px-5">
        <SettingsForm
          initial={{
            fullName: p.fullName,
            email: p.email ?? '',
            addressLine: p.profile?.addressLine ?? '',
            city: p.profile?.city ?? '',
            state: p.profile?.state ?? '',
            pincode: p.profile?.pincode ?? '',
            occupation: p.profile?.occupation ?? '',
            notifyEmail: p.profile?.notifyEmail ?? true,
            notifySms: p.profile?.notifySms ?? true,
            notifyWhatsapp: p.profile?.notifyWhatsapp ?? false,
          }}
        />
        <section className="surface-flat space-y-3 p-5 text-sm leading-relaxed text-ui-muted">
          <p className="font-semibold text-ui-text">Your data</p>
          <p>
            You can read our{' '}
            <Link href="/privacy" className="text-mint">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="text-mint">
              Terms
            </Link>
            . You can ask us to correct or erase your personal data. We keep records that the law requires, such as donation and payment records.
          </p>
        </section>
      </div>
    </main>
  );
}
