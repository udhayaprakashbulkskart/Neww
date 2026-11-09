import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { getRequestRegion } from '@/lib/server/locale';
import { LogoutButton } from '@/components/client';
import { DeleteAccountForm } from '@/components/account/delete-account-form';
import { PreferencesForm } from '@/components/region/region-context';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { t } = await getRequestRegion();
  const blocked = user.role !== 'MEMBER';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('account.title')}</h1>
        <p className="text-sm text-[#a39a86]">{t('account.signedInAs')} {user.email ?? user.name}</p>
      </div>

      <Section title={t('account.preferencesTitle')} subtitle={t('account.preferencesSubtitle')}>
        <PreferencesForm />
      </Section>

      <Section title={t('account.sessionTitle')}>
        <LogoutButton />
      </Section>

      <Section title={t('account.deleteTitle')} subtitle={t('account.deleteWarning')}>
        <div className="space-y-4 text-sm text-[#cfc6b0]">
          <p>{t('account.deleteBody1')}</p>
          <p>{t('account.deleteBody2')}</p>
          {blocked ? (
            <Notice tone="warn">{t('account.deleteBlocked')}</Notice>
          ) : (
            <>
              <p className="text-[#8f8672]">{t('account.deleteRequirement')}</p>
              <DeleteAccountForm />
            </>
          )}
        </div>
      </Section>
    </div>
  );
}
