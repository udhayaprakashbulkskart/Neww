export const WIZARD_STEPS = [
  { key: 'details', label: 'Campaign' },
  { key: 'personal', label: 'Personal' },
  { key: 'financial', label: 'Financial' },
  { key: 'documents', label: 'Documents' },
  { key: 'identity', label: 'Identity' },
  { key: 'address', label: 'Address' },
  { key: 'bank', label: 'Bank' },
  { key: 'review', label: 'Review' },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key'];

export function stepIndex(key: WizardStepKey): number {
  return WIZARD_STEPS.findIndex((s) => s.key === key);
}

export function nextStepHref(campaignId: string, key: WizardStepKey): string {
  const i = stepIndex(key);
  const next = WIZARD_STEPS[i + 1];
  return next ? `/app/create/${campaignId}/${next.key}` : `/app/status/${campaignId}/pending`;
}

export function prevStepHref(campaignId: string, key: WizardStepKey): string {
  const i = stepIndex(key);
  const prev = WIZARD_STEPS[i - 1];
  return prev ? `/app/create/${campaignId}/${prev.key}` : '/app/create';
}
