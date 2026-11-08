'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Logo } from './ui';

interface MenuItem { href: string; label: string; desc: string }
interface MenuGroup { label: string; items: MenuItem[] }

export const MENU: MenuGroup[] = [
  {
    label: 'Platform',
    items: [
      { href: '/#how', label: 'How it works', desc: 'Join, shop, watch and grow your team in three steps.' },
      { href: '/#plans', label: 'Membership plans', desc: 'Four tiers with cashback caps from 10% to 50%.' },
      { href: '/#earn', label: 'Earn with ads', desc: 'Advertiser-funded videos, paid in full when watched.' },
      { href: '/#tree', label: 'Binary team', desc: 'Left and right placement with matched-volume rewards.' },
    ],
  },
  {
    label: 'Shopping',
    items: [
      { href: '/#plans', label: 'Cashback coupons', desc: 'Coupons from partner merchants, capped by your plan.' },
      { href: '/login', label: 'Partner offers', desc: 'Member deals from partner stores. Sign in to browse.' },
      { href: '/login?mode=register', label: 'Shop with CrownTree', desc: 'Create a free account and start shopping.' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { href: '/install', label: 'Download app', desc: 'Install CrownTree on Android, iPhone or your computer.' },
      { href: '/compliance', label: 'Compliance and terms', desc: 'How we earn, pay and protect your money and data.' },
      { href: '/compliance#privacy', label: 'Privacy', desc: 'What we collect and how it is protected.' },
    ],
  },
];

function Dropdown({ group, open, onOpen, onClose }: { group: MenuGroup; open: boolean; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${open ? 'text-white' : 'text-[#b9b09a] hover:text-white'}`}
      >
        {group.label}
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div
        className={`absolute left-1/2 top-full z-40 w-[360px] -translate-x-1/2 pt-3 transition duration-200 ${open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'}`}
        role="menu"
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-2 shadow-[0_30px_80px_rgba(0,0,0,.8)]">
          {group.items.map((it) => (
            <Link key={it.label} href={it.href} role="menuitem" onClick={onClose} className="group flex gap-3 rounded-xl p-3 transition hover:bg-white/[0.05]">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-xs font-black text-black">{it.label.slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#f5efe1] group-hover:text-[#f7e09a]">{it.label}</span>
                <span className="block text-xs leading-relaxed text-[#8f8672]">{it.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicHeader() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const open = (i: number) => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpenIdx(i); };
  const close = () => { closeTimer.current = setTimeout(() => setOpenIdx(null), 120); };

  return (
    <header className={`sticky top-0 z-30 border-b transition-all duration-300 ${scrolled ? 'border-white/10 bg-black/85 shadow-[0_10px_40px_rgba(0,0,0,.6)] backdrop-blur-xl' : 'border-transparent bg-black/40 backdrop-blur-sm'}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" aria-label="CrownTree home" className="shrink-0"><Logo /></Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {MENU.map((g, i) => (
            <Dropdown key={g.label} group={g} open={openIdx === i} onOpen={() => open(i)} onClose={close} />
          ))}
          <Link href="/#plans" className="rounded-lg px-3 py-2 text-sm font-medium text-[#b9b09a] hover:text-white">Plans</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[#b9b09a] hover:text-white sm:inline">Sign in</Link>
          <span className="hidden sm:inline-flex"><Link href="/login?mode=register" className="btn btn-brand whitespace-nowrap px-4 py-2.5 text-sm">Join free</Link></span>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-[#f5efe1] lg:hidden" aria-label={drawer ? 'Close menu' : 'Open menu'} aria-expanded={drawer} onClick={() => setDrawer((d) => !d)}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {drawer ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      <div className={`overflow-hidden border-t border-white/5 bg-black/95 backdrop-blur-xl transition-[max-height] duration-300 lg:hidden ${drawer ? 'max-h-[80vh] overflow-y-auto' : 'max-h-0'}`}>
        <nav className="space-y-6 p-6" aria-label="Mobile">
          {MENU.map((g) => (
            <div key={g.label}>
              <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">{g.label}</div>
              <ul className="mt-3 space-y-1">
                {g.items.map((it) => (
                  <li key={it.label}>
                    <Link href={it.href} onClick={() => setDrawer(false)} className="block rounded-xl px-3 py-3 hover:bg-white/5">
                      <span className="block text-sm font-semibold">{it.label}</span>
                      <span className="block text-xs text-[#8f8672]">{it.desc}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link href="/login" className="btn btn-ghost py-3" onClick={() => setDrawer(false)}>Sign in</Link>
            <Link href="/login?mode=register" className="btn btn-brand py-3" onClick={() => setDrawer(false)}>Join free</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
