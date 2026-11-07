'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';

/** Nav link that shows the active page. Used by the desktop sidebar and the mobile bar. */
export function NavLink({ href, label, icon, variant }: { href: string; label: string; icon: string; variant: 'side' | 'bottom' }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  if (variant === 'bottom') {
    return (
      <Link href={href} aria-current={active ? 'page' : undefined}
        className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold transition ${active ? 'text-[#f7e09a]' : 'text-[#8f8672] hover:text-white'}`}>
        <span className={`grid h-8 w-12 place-items-center rounded-full transition ${active ? 'bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black' : ''}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        {label.split(' ')[0]}
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-white/[0.07] text-white' : 'text-[#b9b09a] hover:bg-white/5 hover:text-white'}`}>
      {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[linear-gradient(180deg,#ff6a00,#d4af37)]" />}
      <span className={`grid h-8 w-8 place-items-center rounded-lg transition ${active ? 'bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black' : 'bg-white/5 text-[#f7e09a] group-hover:bg-white/10'}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      {label}
    </Link>
  );
}
