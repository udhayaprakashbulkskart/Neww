import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { LogoutButton } from '@/components/client';
import { DeleteAccountForm } from '@/components/account/delete-account-form';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const blocked = user.role !== 'MEMBER';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-[#a39a86]">Signed in as {user.email ?? user.name}</p>
      </div>

      <Section title="Session">
        <LogoutButton />
      </Section>

      <Section title="Delete account" subtitle="This cannot be undone.">
        <div className="space-y-4 text-sm text-[#cfc6b0]">
          <p>Deleting your account removes your name, email, mobile number, password, identity documents and bank details. You will not be able to sign in again.</p>
          <p>Your order, payment and ledger history is kept as legal financial records and cannot be erased. It is no longer linked to your personal details.</p>
          {blocked ? (
            <Notice tone="warn">Staff, merchant and advertiser accounts are closed by an administrator. Contact support.</Notice>
          ) : (
            <>
              <p className="text-[#8f8672]">You must withdraw your full wallet balance, and have no withdrawal or order in progress, before deleting.</p>
              <DeleteAccountForm />
            </>
          )}
        </div>
      </Section>
    </div>
  );
}
