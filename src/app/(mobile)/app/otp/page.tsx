import Link from 'next/link';
import { Logo, Icon } from '@/components/ui/icons';
import { OtpForm } from '@/components/mobile/forms/otp-form';

export const metadata = { title: 'Verify your number' };

export default function OtpPage() {
  return (
    <main className="flex min-h-dvh flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),24px)]">
      <Link href="/app/login" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-ink-850">
        <Icon name="back" />
      </Link>
      <div className="mt-8 flex items-center gap-3">
        <Logo />
        <span className="text-lg font-bold">HelpTrust</span>
      </div>
      <h1 className="mt-10 text-[32px] font-extrabold leading-tight tracking-tight">
        Enter the <span className="text-mint">code</span>
      </h1>
      <OtpForm />
    </main>
  );
}
