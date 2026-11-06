import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { Logo, Icon } from '@/components/ui/icons';

export default async function SplashPage() {
  if (await getCurrentUser()) redirect('/app/home');
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-6 pb-10 pt-[max(env(safe-area-inset-top),48px)]">
      {/* Atmosphere: warm light behind the hands motif, kept abstract so no stock imagery is implied */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(60%_60%_at_50%_30%,rgba(92,255,177,0.22),transparent_70%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-emerald/10 blur-3xl" />

      <div className="relative flex flex-col items-center pt-10">
        <Logo className="h-16 w-16 rounded-[22px]" />
        <p className="mt-5 text-[28px] font-extrabold tracking-tight">HelpTrust</p>
      </div>

      <div className="relative mt-auto">
        <div className="mb-8 flex h-[220px] items-center justify-center animate-rise">
          <img src="/illustrations/hands-heart.svg" alt="" className="animate-float h-full w-auto" />
        </div>
        <h1 className="text-balance text-[40px] font-extrabold leading-[1.05] tracking-tight">
          Real People.
          <br />
          Real Problems.
          <br />
          <span className="text-mint">Verified Help.</span>
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-ui-muted">
          A trusted place to get financial support for genuine needs, and to give to people whose requests have been verified.
        </p>

        <div className="mt-10 flex justify-center gap-2" aria-hidden="true">
          <span className="h-1.5 w-6 rounded-full bg-mint" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        </div>

        <Link href="/app/onboarding" className="btn-primary mt-8 w-full">
          Get Started
          <Icon name="arrowRight" className="h-5 w-5" />
        </Link>
        <p className="mt-4 text-center text-xs text-ui-subtle">
          Already registered?{' '}
          <Link href="/app/login" className="font-semibold text-mint">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
