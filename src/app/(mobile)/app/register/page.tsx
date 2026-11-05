import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { Logo, Icon } from '@/components/ui/icons';
import { RegisterForm } from '@/components/mobile/forms/register-form';

export const metadata = { title: 'Create account' };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/app/home');
  return (
    <main className="flex min-h-dvh flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),24px)]">
      <Link href="/app/onboarding" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-ink-850">
        <Icon name="back" />
      </Link>
      <div className="mt-8 flex items-center gap-3">
        <Logo />
        <span className="text-lg font-bold">HelpTrust</span>
      </div>
      <h1 className="mt-10 text-[32px] font-extrabold leading-tight tracking-tight">
        Create your <span className="text-mint">account</span>
      </h1>
      <p className="mt-2 text-[15px] text-ui-muted">It takes under a minute. Verification is done later, only when you need it.</p>
      <RegisterForm />
    </main>
  );
}
