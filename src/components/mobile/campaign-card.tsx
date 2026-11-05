import Link from 'next/link';
import type { CampaignCard as Card } from '@/lib/services/campaigns';
import { formatINR, formatINRCompact } from '@/lib/format';
import { CampaignImage, ProgressBar, VerifiedBadge } from '@/components/ui/primitives';

const TONES = ['tone-yellow', 'tone-pink', 'tone-mint', 'tone-sky'] as const;

/** Stable pastel tone per campaign, so the same card keeps its colour across screens. */
export function toneFor(id: string, fallback?: string | null) {
  if (fallback === 'yellow' || fallback === 'pink' || fallback === 'mint' || fallback === 'sky') return `tone-${fallback}`;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** Large pastel card used in carousels: photo, verified badge, title, amounts, progress and donate. */
export function CampaignCardLarge({ c }: { c: Card }) {
  const tone = toneFor(c.id, c.category.tone);
  return (
    <article className={`${tone} group relative w-[280px] shrink-0 snap-start overflow-hidden rounded-[28px] shadow-card transition duration-300 hover:-translate-y-0.5`}>
      <Link href={`/app/campaign/${c.slug}`} className="block" aria-label={`View ${c.title}`}>
        <div className="relative h-[168px] overflow-hidden">
          <CampaignImage src={c.imageUrl} name={c.beneficiaryName} className="h-full w-full" />
          <div className="absolute left-3 top-3">
            <VerifiedBadge className="bg-white/80 text-emerald-700 backdrop-blur" />
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider opacity-60">{c.category.name}</p>
            <h3 className="mt-0.5 line-clamp-2 text-[17px] font-bold leading-snug">{c.title}</h3>
          </div>
          <div className="flex items-end justify-between text-sm">
            <div>
              <p className="text-[12px] opacity-60">Raised of {formatINRCompact(c.requestedPaise)}</p>
              <p className="font-bold">{formatINR(c.raisedPaise)}</p>
            </div>
            <p className="text-lg font-bold">{c.fundingPercent}%</p>
          </div>
          <ProgressBar value={c.fundingPercent} tone="dark" />
        </div>
      </Link>
      <div className="px-4 pb-4">
        <Link href={`/app/donate/${c.slug}`} className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink-950 text-[15px] font-semibold text-mint transition active:scale-[0.98]">
          Donate now
        </Link>
      </div>
    </article>
  );
}

/** Compact dark row for lists (Explore, Saved, search results). */
export function CampaignRow({ c }: { c: Card }) {
  return (
    <Link href={`/app/campaign/${c.slug}`} className="surface flex gap-4 p-3 transition hover:border-mint/20">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
        <CampaignImage src={c.imageUrl} name={c.beneficiaryName} className="h-full w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <VerifiedBadge />
          </div>
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{c.title}</h3>
          <p className="mt-1 truncate text-xs text-ui-muted">
            {c.beneficiaryName} · {c.city || 'India'}
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-semibold text-ui-text">{formatINRCompact(c.raisedPaise)}</span>
            <span className="text-mint">{c.fundingPercent}%</span>
          </div>
          <ProgressBar value={c.fundingPercent} />
        </div>
      </div>
    </Link>
  );
}

/** Donor-facing summary of a campaign tile in a 2-column grid. */
export function CampaignTile({ c }: { c: Card }) {
  const tone = toneFor(c.id, c.category.tone);
  return (
    <Link href={`/app/campaign/${c.slug}`} className={`${tone} flex flex-col overflow-hidden rounded-[24px] shadow-card transition hover:-translate-y-0.5`}>
      <div className="relative h-28 overflow-hidden">
        <CampaignImage src={c.imageUrl} name={c.beneficiaryName} className="h-full w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">{c.category.name}</p>
        <h3 className="line-clamp-2 text-[14px] font-bold leading-snug">{c.title}</h3>
        <div className="mt-auto space-y-1.5">
          <ProgressBar value={c.fundingPercent} tone="dark" />
          <p className="text-[12px] font-semibold">{c.fundingPercent}% · {formatINRCompact(c.raisedPaise)}</p>
        </div>
      </div>
    </Link>
  );
}
