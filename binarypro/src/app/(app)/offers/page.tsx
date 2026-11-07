import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { canOpenOffer, tierLabel } from '@/lib/domain/offers';
import { type Tier } from '@/lib/domain/plans';
import { Notice } from '@/components/ui';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 24;

function href(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/offers?${qs}` : '/offers';
}

export default async function Offers({ searchParams }: { searchParams: { q?: string; category?: string; page?: string; locked?: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const now = new Date();
  const tier = (user.membership?.tier ?? 'BASIC') as Tier;
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const category = (searchParams.category ?? '').trim().slice(0, 60);
  const page = Math.max(1, Math.min(10_000, Number(searchParams.page) || 1));

  const base = { active: true, validUntil: { gt: now } };
  const where = {
    ...base,
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { partnerName: { contains: q, mode: 'insensitive' as const } }] } : {}),
  };
  const [total, offers, cats] = await Promise.all([
    db.partnerOffer.count({ where }),
    db.partnerOffer.findMany({ where, orderBy: [{ partnerName: 'asc' }, { title: 'asc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.partnerOffer.groupBy({ by: ['category'], where: base, _count: { _all: true }, orderBy: { category: 'asc' } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Partner offers</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#8f8672]">Discounts from our partner stores and services. You buy directly from the partner. CrownTree does not pay cashback on partner purchases. Offers open in a new step on the partner’s site.</p>
      </header>

      {searchParams.locked && <Notice tone="warn">That offer needs a higher membership plan, or it is no longer available.</Notice>}
      {!(user.membership && user.membership.expiresAt > now) && <Notice tone="warn">An active membership is needed to open offers.</Notice>}

      <form action="/offers" className="grid gap-3 md:grid-cols-[1fr_220px_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Search partners or offers" aria-label="Search offers" className="input" maxLength={80} />
        <select name="category" defaultValue={category} aria-label="Category" className="input">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.category} value={c.category}>{c.category} ({c._count._all})</option>)}
        </select>
        <button className="btn btn-brand px-6">Search</button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#8f8672]">
        <span>{total.toLocaleString('en-IN')} offer{total === 1 ? '' : 's'}{category ? ` in ${category}` : ''}{q ? ` matching “${q}”` : ''}</span>
        <span>Your plan: <span className="font-semibold text-[#f7e09a]">{tierLabel(tier)}</span></span>
      </div>

      {offers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-[#8f8672]">No offers match your search.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {offers.map((o) => {
            const open = canOpenOffer(tier, o.minTier as Tier);
            return (
              <article key={o.id} className={`flex flex-col rounded-3xl border p-5 transition ${open ? 'border-white/10 bg-white/[0.03] hover:border-[#d4af37]/40' : 'border-white/5 bg-white/[0.015] opacity-80'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">{o.partnerName} · {o.category}</div>
                    <h2 className="mt-1 text-base font-bold leading-snug">{o.title}</h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#d4af37]/30 px-2.5 py-0.5 text-[11px] font-bold text-[#f7e09a]">{tierLabel(o.minTier as Tier)}+</span>
                </div>
                <div className="mt-4 text-2xl font-black text-[#f7e09a]">{o.discountLabel}</div>
                {o.description && <p className="mt-2 text-xs leading-relaxed text-[#8f8672]">{o.description}</p>}
                {open && o.couponCode && (
                  <div className="mt-4 rounded-xl border border-dashed border-[#d4af37]/40 bg-black/40 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[.2em] text-[#8f8672]">Code</div>
                    <div className="font-mono text-sm font-bold tracking-wider">{o.couponCode}</div>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-xs text-[#8f8672]">Until {o.validUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {open ? (
                    <a href={`/api/offers/${o.id}/go`} className="btn btn-brand px-4 py-2 text-xs">Open offer <Icon name="arrow" className="h-3.5 w-3.5" /></a>
                  ) : (
                    <span className="rounded-full border border-white/10 px-3 py-2 text-xs text-[#b9b09a]">Needs {tierLabel(o.minTier as Tier)}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 && <Link className="btn btn-ghost px-4 py-2" href={href({ q, category, page: String(page - 1) })}>Previous</Link>}
          <span className="text-[#8f8672]">Page {page} of {pages}</span>
          {page < pages && <Link className="btn btn-ghost px-4 py-2" href={href({ q, category, page: String(page + 1) })}>Next</Link>}
        </nav>
      )}
    </div>
  );
}
