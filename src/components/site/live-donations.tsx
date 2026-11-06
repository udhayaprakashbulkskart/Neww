'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FeedItem } from '@/lib/services/live-feed';

const REFRESH_MS = 8000;

function formatRupees(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Live list of recent real donations, by city. Polls every few seconds and pauses in background tabs. */
export function LiveDonations({ initial }: { initial: FeedItem[] }) {
  const [items, setItems] = useState<FeedItem[]>(initial);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/feed/donations', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { ok: boolean; data?: { items: FeedItem[] } };
        if (!cancelled && body.ok && body.data) setItems(body.data.items);
      } catch {
        // Keep the last list on screen if the network drops.
      }
    }

    setNow(Date.now());
    const poll = setInterval(() => {
      setNow(Date.now());
      void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 lg:px-8" aria-labelledby="live-feed-h">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint" />
            </span>
            Live giving
          </p>
          <h2 id="live-feed-h" className="mt-2 text-[28px] font-extrabold tracking-tight">
            Donations happening now
          </h2>
          <p className="mt-2 max-w-xl text-sm text-ui-muted">Real donations on HelpTrust, shown by city. Refreshes every few seconds.</p>
        </div>
        <Link href="/explore" className="text-sm font-semibold text-mint">
          Support a campaign
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="surface-flat p-8 text-center text-sm text-ui-muted">No donations yet. The first one will appear here.</div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" aria-live="polite">
          {items.map((it) => (
            <li key={it.id} className="surface-flat flex items-center gap-4 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint/15 text-base font-bold text-mint">
                {it.city.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">Someone in {it.city}</span> donated{' '}
                  <span className="font-bold text-mint">{formatRupees(it.amountPaise)}</span>
                </p>
                <Link href={`/campaigns/${it.campaignSlug}`} className="block truncate text-xs text-ui-muted hover:text-ui-text">
                  to {it.campaignTitle}
                </Link>
              </div>
              <span className="shrink-0 text-xs text-ui-subtle">{now === null ? '' : timeAgo(it.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
