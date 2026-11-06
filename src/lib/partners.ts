export type PartnerCharity = { name: string; logo: string };

/**
 * Partner charities shown in the landing-page logo strip.
 * Add one entry per partner and put its logo file in public/partners/.
 * Example: { name: 'Example Trust', logo: '/partners/example-trust.svg' }
 */
export const PARTNER_CHARITIES: PartnerCharity[] = [];
