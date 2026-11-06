import type { IconName } from '@/components/ui/icons';

/** Icon and card tone for each campaign category slug. Unknown slugs fall back to a generic icon and tone. */
export const CATEGORY_ICON: Record<string, IconName> = {
  'debt-relief': 'wallet',
  medical: 'heart',
  education: 'file',
  family: 'users',
  emergency: 'alert',
  business: 'chart',
  'disaster-relief': 'alert',
  'elderly-care': 'heart',
  'disability-support': 'shield',
  'farmers-livelihood': 'chart',
  'widows-single-parents': 'users',
};

export function categoryIcon(slug: string): IconName {
  return CATEGORY_ICON[slug] ?? 'grid';
}
