import Link from 'next/link';
import { OnboardingCarousel } from '@/components/mobile/forms/onboarding';

export default function OnboardingPage() {
  return (
    <main className="flex min-h-dvh flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),20px)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ui-subtle">HelpTrust</span>
        <Link href="/app/login" className="text-sm font-semibold text-mint">
          Skip
        </Link>
      </div>
      <OnboardingCarousel />
    </main>
  );
}
