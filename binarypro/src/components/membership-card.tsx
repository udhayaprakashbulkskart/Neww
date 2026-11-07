import type { Tier } from '@/lib/domain/plans';

const THEME: Record<Tier, { bg: string; ring: string; label: string }> = {
  BASIC: { bg: 'linear-gradient(135deg,#1b1b1b,#070707 60%,#2b1a08)', ring: '#5a4a2a', label: 'Basic' },
  SILVER: { bg: 'linear-gradient(135deg,#d9dde3,#6b717b 45%,#15171b)', ring: '#c9ced6', label: 'Silver' },
  GOLD: { bg: 'linear-gradient(135deg,#f7e09a,#d4af37 40%,#7a5a10)', ring: '#f7e09a', label: 'Gold' },
  PLATINUM: { bg: 'linear-gradient(135deg,#ff8c33,#ff6a00 35%,#2b1000 75%,#000)', ring: '#ff8c33', label: 'Platinum' },
};

export function MembershipCard({ tier, name, active, expires }: { tier: Tier; name: string; active: boolean; expires?: Date | null }) {
  const t = THEME[tier];
  return (
    <div
      className="relative aspect-[1.7/1] w-full max-w-md overflow-hidden rounded-2xl p-5 text-white shadow-2xl"
      style={{ background: t.bg, boxShadow: `0 20px 60px rgba(0,0,0,.7), inset 0 0 0 1px ${t.ring}55` }}
    >
      <div className="flex items-start justify-between">
        <div className="text-sm font-extrabold tracking-widest text-black/80 mix-blend-normal">BINARYPRO</div>
        <div className="rounded-full border border-black/40 bg-black/30 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
          {active ? t.label : 'Inactive'}
        </div>
      </div>
      <div className="absolute bottom-5 left-5 right-5">
        <div className="text-xs uppercase tracking-[.25em] text-black/70">Member</div>
        <div className="mt-1 text-xl font-bold text-black drop-shadow">{name}</div>
        <div className="mt-2 text-xs text-black/70">{expires ? `Valid until ${expires.toLocaleDateString('en-IN')}` : 'Membership'}</div>
      </div>
    </div>
  );
}
