'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { teamApi } from '@/lib/team/client';
import { Avatar, btnGhost, btnPrimary, KycBadge, Notice, card } from './ui';
import type { MemberCard } from '@/lib/team/members';

type Filter = 'ALL' | 'VERIFIED' | 'PENDING';

export function Directory({ members, meId }: { members: MemberCard[]; meId: string }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [error, setError] = useState<string | null>(null);
  const [openingFor, setOpeningFor] = useState<string | null>(null);
  const router = useRouter();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === 'VERIFIED' && m.kycStatus !== 'VERIFIED') return false;
      if (filter === 'PENDING' && m.kycStatus !== 'PENDING') return false;
      if (!q) return true;
      return [m.fullName, m.phone, m.jobTitle ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [members, query, filter]);

  async function startChat(memberId: string) {
    setError(null);
    setOpeningFor(memberId);
    try {
      const convo = await teamApi<{ id: string }>('/api/team/conversations', { body: { memberId } });
      router.push(`/team/chat/${convo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the chat.');
      setOpeningFor(null);
    }
  }

  const pills: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'All members' },
    { key: 'VERIFIED', label: 'Verified' },
    { key: 'PENDING', label: 'Pending KYC' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tp-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone or role"
            aria-label="Search team members"
            className="w-full rounded-xl border border-tp-line bg-white py-2.5 pl-10 pr-3.5 text-sm outline-none transition placeholder:text-tp-muted focus:border-tp-purple focus:ring-4 focus:ring-tp-purple/15"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-tp-line bg-white p-1" role="group" aria-label="View">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === v ? 'bg-tp-purple text-white' : 'text-tp-muted hover:text-tp-ink'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by KYC status">
        {pills.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setFilter(p.key)}
            aria-pressed={filter === p.key}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
              filter === p.key ? 'bg-tp-purple text-white ring-tp-purple' : 'bg-white text-tp-muted ring-tp-line hover:text-tp-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-tp-muted">
          {visible.length} of {members.length} members
        </span>
      </div>

      {error && <Notice>{error}</Notice>}

      {visible.length === 0 && (
        <div className={`${card} p-10 text-center`}>
          <p className="font-semibold">No members match these filters.</p>
          <p className="mt-1 text-sm text-tp-muted">Try a different search or clear the filter.</p>
        </div>
      )}

      {view === 'grid' ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((m) => (
            <li key={m.id} className={`${card} flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(109,77,242,0.45)]`}>
              <div className="flex items-start gap-4">
                <Avatar name={m.fullName} initials={m.initials} photoUrl={m.photoUrl} size="lg" seed={m.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{m.fullName}{m.id === meId && <span className="ml-2 text-xs font-medium text-tp-muted">(you)</span>}</p>
                  <p className="truncate text-sm text-tp-muted">{m.jobTitle ?? 'Team member'}</p>
                  <a href={`tel:${m.phone}`} className="mt-1 block truncate text-sm font-medium text-tp-purple hover:underline">
                    {m.phone}
                  </a>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <KycBadge status={m.kycStatus} />
                {!m.active && <span className="text-xs font-semibold text-rose-600">Deactivated</span>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {m.id !== meId ? (
                  <button type="button" onClick={() => startChat(m.id)} disabled={openingFor === m.id} className={btnPrimary}>
                    {openingFor === m.id ? 'Opening…' : 'Chat'}
                  </button>
                ) : (
                  <span />
                )}
                <Link href={`/team/members/${m.id}`} className={`${btnGhost} ${m.id === meId ? 'col-span-2' : ''}`}>
                  View Profile
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={`${card} divide-y divide-tp-line overflow-hidden`}>
          {visible.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5 md:flex-nowrap">
              <Avatar name={m.fullName} initials={m.initials} photoUrl={m.photoUrl} size="md" seed={m.id} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.fullName}{m.id === meId && <span className="ml-2 text-xs font-medium text-tp-muted">(you)</span>}</p>
                <p className="truncate text-sm text-tp-muted">{m.jobTitle ?? 'Team member'} · {m.phone}</p>
              </div>
              <KycBadge status={m.kycStatus} />
              <div className="flex gap-2">
                {m.id !== meId && (
                  <button type="button" onClick={() => startChat(m.id)} disabled={openingFor === m.id} className={`${btnPrimary} !px-3 !py-2`}>
                    Chat
                  </button>
                )}
                <Link href={`/team/members/${m.id}`} className={`${btnGhost} !px-3 !py-2`}>
                  View Profile
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
