'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';
import { StepDots } from '@/components/mobile/shell';

const SLIDES: { icon: IconName; title: string; body: string; tone: string }[] = [
  {
    icon: 'heart',
    title: 'Real people, real problems',
    body: 'Families facing debt, medical bills and school fees can ask for help in their own words, with the details that matter.',
    tone: 'bg-pastel-yellow',
  },
  {
    icon: 'shield',
    title: 'Every request is verified',
    body: 'Identity, address, bank account and bills are checked, and a person reviews each campaign before it goes live.',
    tone: 'bg-pastel-mint',
  },
  {
    icon: 'receipt',
    title: 'Give with confidence',
    body: 'Every donation is confirmed by our payment provider and gets a receipt. You can see where funds go and request a refund if needed.',
    tone: 'bg-pastel-pink',
  },
];

export function OnboardingCarousel() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        <div key={index} className={`${slide.tone} animate-rise flex h-56 w-56 items-center justify-center rounded-[44px] text-ink-950 shadow-card`}>
          <Icon name={slide.icon} className="h-24 w-24" strokeWidth={1.4} />
        </div>
        <h1 className="animate-rise mt-10 text-balance text-[30px] font-extrabold leading-tight tracking-tight">{slide.title}</h1>
        <p className="animate-rise mt-4 max-w-[330px] text-[15px] leading-relaxed text-ui-muted">{slide.body}</p>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <StepDots total={SLIDES.length} current={index + 1} />
        {last ? (
          <Link href="/app/register" className="btn-primary h-14 px-8">
            Get started
          </Link>
        ) : (
          <button type="button" onClick={() => setIndex((i) => i + 1)} className="btn-primary h-14 px-8">
            Next
          </button>
        )}
      </div>
      {last && (
        <p className="mt-6 text-center text-xs text-ui-subtle">
          By continuing you agree to our{' '}
          <Link href="/terms" className="text-mint">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-mint">
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </div>
  );
}
