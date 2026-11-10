import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTeamActor } from '@/lib/team/session';
import { LoginForm } from '@/components/team/login-form';

export const metadata: Metadata = { title: { absolute: 'Team sign in · Team Portal' }, robots: { index: false, follow: false } };

export default async function TeamLoginPage() {
  if (await getTeamActor()) redirect('/team');
  return (
    <main className="flex min-h-dvh items-center justify-center bg-tp-canvas px-4 py-10 text-tp-ink">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tp-purple text-lg font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(109,77,242,0.9)]">
            TP
          </span>
          <div>
            <p className="text-lg font-bold leading-tight">Team Portal</p>
            <p className="text-sm text-tp-muted">Sign in to your team workspace</p>
          </div>
        </div>
        <div className="rounded-3xl border border-tp-line bg-white p-6 shadow-[0_24px_60px_-30px_rgba(40,30,110,0.35)] md:p-8">
          <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Welcome back</h1>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
