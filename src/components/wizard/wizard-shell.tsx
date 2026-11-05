import { WIZARD_STEPS, stepIndex, prevStepHref, type WizardStepKey } from '@/lib/wizard';
import { StepDots, TopBar } from '@/components/mobile/shell';

/** Shared frame for every campaign creation step: progress, back link, title and helper copy. */
export function WizardShell({
  campaignId,
  step,
  title,
  subtitle,
  children,
}: {
  campaignId: string;
  step: WizardStepKey;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const index = stepIndex(step) + 1;
  return (
    <main className="pb-12">
      <TopBar back={prevStepHref(campaignId, step)} title="Create campaign" subtitle={`Step ${index} of ${WIZARD_STEPS.length} · ${WIZARD_STEPS[index - 1].label}`} />
      <div className="space-y-7 px-5">
        <StepDots total={WIZARD_STEPS.length} current={index} />
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ui-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
