const WORDS = ['Shop', 'Watch', 'Earn', 'Grow', 'Lead', 'Prosper', 'Cashback', 'Partner offers', 'Global reach'];

/** Endless scrolling strip. Content is duplicated so the loop is seamless. */
export function Ticker() {
  const items = [...WORDS, ...WORDS];
  return (
    <div className="relative overflow-hidden border-y border-[#d4af37]/20 bg-black/60 py-4" aria-hidden="true">
      <div className="anim-marquee flex w-max gap-10 whitespace-nowrap text-sm font-black uppercase tracking-[.3em] text-[#f7e09a]">
        {items.map((w, i) => (
          <span key={i} className="flex items-center gap-10">
            {w}
            <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#ff6a00]" />
          </span>
        ))}
      </div>
    </div>
  );
}
