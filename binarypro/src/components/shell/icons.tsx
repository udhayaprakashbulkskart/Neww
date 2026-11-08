// Minimal line icons (24px grid) used across the app shell and dashboards.
const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  tree: 'M12 3v6m0 0l-5 4m5-4l5 4M7 21v-4m10 4v-4M5 13v4m14-4v4',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm0 0V6a2 2 0 0 1 2-2h11',
  play: 'M8 5v14l11-7z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  store: 'M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  copy: 'M9 9h10v12H9zM5 15V5h10',
  arrow: 'M5 12h14m-6-6l6 6-6 6',
  chart: 'M4 20V10m6 10V4m6 16v-7m6 7H2',
  spin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0v9l6 3M12 3v2m9 7h-2M3 12h2',
};

export function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof P | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={P[name] ?? P.home} />
    </svg>
  );
}
