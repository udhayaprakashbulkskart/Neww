import type { Tier } from '@/lib/domain/plans';
import type { Translator } from '@/lib/i18n/messages';
import type { Locale } from '@/lib/i18n/locales';

// Each tier sets its background and text colour together, so labels always contrast with the card.
const THEME: Record<Tier, { bg: string; ring: string; label: string; ink: string; sub: string; chip: string }> = {
  BASIC: {
    bg: 'linear-gradient(135deg,#7a5a22 0%,#3a2a12 48%,#1a1208 100%)',
    ring: '#d4af37',
    label: 'Basic',
    ink: '#fff7e0',
    sub: 'rgba(255,247,224,.72)',
    chip: 'border-[#f7e09a]/40 bg-black/30 text-[#f7e09a]',
  },
  SILVER: {
    bg: 'linear-gradient(135deg,#e6e9ee,#8d949e 45%,#2a2d33)',
    ring: '#c9ced6',
    label: 'Silver',
    ink: '#0b0b0b',
    sub: 'rgba(0,0,0,.65)',
    chip: 'border-black/40 bg-black/30 text-black',
  },
  GOLD: {
    bg: 'linear-gradient(135deg,#f7e09a,#d4af37 40%,#7a5a10)',
    ring: '#f7e09a',
    label: 'Gold',
    ink: '#0b0b0b',
    sub: 'rgba(0,0,0,.65)',
    chip: 'border-black/40 bg-black/30 text-black',
  },
  PLATINUM: {
    bg: 'linear-gradient(135deg,#ff8c33,#ff6a00 35%,#2b1000 75%,#000)',
    ring: '#ff8c33',
    label: 'Platinum',
    ink: '#0b0b0b',
    sub: 'rgba(0,0,0,.65)',
    chip: 'border-black/40 bg-black/30 text-black',
  },
};

export function MembershipCard({ tier, name, active, expires, t: tr, locale }: { tier: Tier; name: string; active: boolean; expires?: Date | null; t: Translator; locale: Locale }) {
  const theme = THEME[tier];
  return (
    <div
      className="relative aspect-[1.7/1] w-full max-w-md overflow-hidden rounded-2xl p-5 shadow-2xl sm:p-6"
      style={{ background: theme.bg, color: theme.ink, boxShadow: `0 20px 60px rgba(0,0,0,.7), inset 0 0 0 1px ${theme.ring}66` }}
    >
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start justify-between">
        <div className="text-sm font-extrabold tracking-widest" style={{ color: theme.ink }}>CROWNTREE</div>
        <div className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${theme.chip}`}>
          {active ? tr(`tier.${tier}` as 'tier.BASIC') : tr('card.inactive')}
        </div>
      </div>
      <div className="absolute bottom-5 left-5 right-5">
        <div className="text-xs uppercase tracking-[.25em]" style={{ color: theme.sub }}>{tr('card.member')}</div>
        <div className="mt-1 truncate text-xl font-bold drop-shadow" style={{ color: theme.ink }}>{name}</div>
        <div className="mt-2 text-xs" style={{ color: theme.sub }}>{expires ? tr('card.validUntil', { date: expires.toLocaleDateString(locale === 'ar' ? 'ar-u-nu-latn' : locale) }) : tr('card.membership')}</div>
      </div>
    </div>
  );
}
