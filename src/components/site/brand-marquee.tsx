import Link from 'next/link';
import { Logo } from '@/components/ui/icons';
import { CampaignImage } from '@/components/ui/primitives';
import { PARTNER_CHARITIES } from '@/lib/partners';

type Card = { id: string; slug: string; title: string; imageUrl: string | null };

type Entry = { key: string; node: React.ReactNode };

/** Auto-scrolling strip: HelpTrust, partner charities and live campaigns. Swings left and right. */
export function BrandMarquee({ campaigns }: { campaigns: Card[] }) {
  const entries: Entry[] = [
    {
      key: 'brand',
      node: (
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <span className="text-[17px] font-bold tracking-tight">HelpTrust</span>
        </div>
      ),
    },
    ...PARTNER_CHARITIES.map((p) => ({
      key: `partner-${p.name}`,
      node: (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.logo} alt="" className="h-9 w-9 rounded-xl bg-white/5 object-contain p-1" />
          <span className="text-[15px] font-semibold">{p.name}</span>
        </div>
      ),
    })),
    ...campaigns.map((c) => ({
      key: `campaign-${c.id}`,
      node: (
        <Link href={`/campaigns/${c.slug}`} className="flex items-center gap-3 text-ui-muted hover:text-ui-text">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xl">
            <CampaignImage src={c.imageUrl} name={c.title} className="h-9 w-9" />
          </span>
          <span className="max-w-[220px] truncate text-[15px] font-medium">{c.title}</span>
        </Link>
      ),
    })),
  ];

  // Repeat the set until one half of the track is wider than a phone screen, so the swing never shows a gap.
  const base = entries.length > 0 ? entries : [];
  const half: Entry[] = [];
  while (base.length > 0 && half.length < 10) {
    for (const e of base) half.push({ ...e, key: `${e.key}-${half.length}` });
  }
  if (half.length === 0) return null;

  const copy = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-10 pr-10">
      {half.map((e) => (
        <li key={e.key} className="shrink-0">
          {e.node}
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Trusted by and supporting" className="overflow-hidden border-y border-white/[0.06] bg-ink-900/60 py-5">
      <div className="flex w-max animate-sway hover:[animation-play-state:paused]">
        {copy(false)}
        {copy(true)}
      </div>
    </section>
  );
}
