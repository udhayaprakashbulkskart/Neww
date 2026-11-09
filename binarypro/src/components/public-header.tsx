'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Logo } from './ui';
import { useT } from '@/components/region/region-context';
import type { MessageKey } from '@/lib/i18n/messages';

interface MenuItem { href: string; label: MessageKey; desc: MessageKey }
interface MenuGroup { label: MessageKey; items: MenuItem[] }

export const MENU: MenuGroup[] = [
  {
    label: 'nav.platform',
    items: [
      { href: '/#how', label: 'menu.howItWorks', desc: 'menu.howItWorksDesc' },
      { href: '/#plans', label: 'menu.membershipPlans', desc: 'menu.membershipPlansDesc' },
      { href: '/#earn', label: 'menu.earnWithAds', desc: 'menu.earnWithAdsDesc' },
      { href: '/#tree', label: 'menu.binaryTeam', desc: 'menu.binaryTeamDesc' },
    ],
  },
  {
    label: 'nav.shopping',
    items: [
      { href: '/#plans', label: 'menu.cashbackCoupons', desc: 'menu.cashbackCouponsDesc' },
      { href: '/login', label: 'menu.partnerOffers', desc: 'menu.partnerOffersDesc' },
      { href: '/login?mode=register', label: 'menu.shopWithUs', desc: 'menu.shopWithUsDesc' },
    ],
  },
  {
    label: 'nav.resources',
    items: [
      { href: '/install', label: 'menu.downloadApp', desc: 'menu.downloadAppDesc' },
      { href: '/compliance', label: 'menu.complianceTerms', desc: 'menu.complianceTermsDesc' },
      { href: '/compliance#privacy', label: 'menu.privacy', desc: 'menu.privacyDesc' },
    ],
  },
];

function Dropdown({ group, open, onOpen, onClose }: { group: MenuGroup; open: boolean; onOpen: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${open ? 'text-white' : 'text-[#b9b09a] hover:text-white'}`}
      >
        {t(group.label)}
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div
        className={`absolute left-1/2 top-full z-40 w-[360px] -translate-x-1/2 pt-3 transition duration-200 ${open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'}`}
        role="menu"
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-2 shadow-[0_30px_80px_rgba(0,0,0,.8)]">
          {group.items.map((it) => (
            <Link key={it.label} href={it.href} role="menuitem" onClick={onClose} className="group flex gap-3 rounded-xl p-3 transition hover:bg-white/[0.05]">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-xs font-black text-black">{t(it.label).slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#f5efe1] group-hover:text-[#f7e09a]">{t(it.label)}</span>
                <span className="block text-xs leading-relaxed text-[#8f8672]">{t(it.desc)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicHeader() {
  const t = useT();
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
        <Link href="/" aria-label={t('common.homeLabel')} className="shrink-0"><Logo /></Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t('nav.mainLabel')}>
          {MENU.map((g, i) => (
            <Dropdown key={g.label} group={g} open={openIdx === i} onOpen={() => open(i)} onClose={close} />
          ))}
          <Link href="/#plans" className="rounded-lg px-3 py-2 text-sm font-medium text-[#b9b09a] hover:text-white">{t('common.plans')}</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[#b9b09a] hover:text-white sm:inline">{t('common.signIn')}</Link>
          <span className="hidden sm:inline-flex"><Link href="/login?mode=register" className="btn btn-brand whitespace-nowrap px-4 py-2.5 text-sm">{t('common.joinFree')}</Link></span>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-[#f5efe1] lg:hidden" aria-label={drawer ? t('common.closeMenu') : t('common.openMenu')} aria-expanded={drawer} onClick={() => setDrawer((d) => !d)}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {drawer ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      <div className={`overflow-hidden border-t border-white/5 bg-black/95 backdrop-blur-xl transition-[max-height] duration-300 lg:hidden ${drawer ? 'max-h-[80vh] overflow-y-auto' : 'max-h-0'}`}>
        <nav className="space-y-6 p-6" aria-label={t('nav.mobileLabel')}>
          {MENU.map((g) => (
            <div key={g.label}>
              <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">{t(g.label)}</div>
              <ul className="mt-3 space-y-1">
                {g.items.map((it) => (
                  <li key={it.label}>
                    <Link href={it.href} onClick={() => setDrawer(false)} className="block rounded-xl px-3 py-3 hover:bg-white/5">
                      <span className="block text-sm font-semibold">{t(it.label)}</span>
                      <span className="block text-xs text-[#8f8672]">{t(it.desc)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link href="/login" className="btn btn-ghost py-3" onClick={() => setDrawer(false)}>{t('common.signIn')}</Link>
            <Link href="/login?mode=register" className="btn btn-brand py-3" onClick={() => setDrawer(false)}>{t('common.joinFree')}</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
