import type { KycStatus } from '@prisma/client';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-tp-purple px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(109,77,242,0.6)] transition hover:bg-tp-purpleDark disabled:cursor-not-allowed disabled:opacity-60';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-tp-line bg-white px-4 py-2.5 text-sm font-semibold text-tp-ink transition hover:border-tp-purple/40 hover:text-tp-purple disabled:opacity-60';
export const inputBase =
  'w-full rounded-xl border border-tp-line bg-white px-3.5 py-2.5 text-sm text-tp-ink outline-none transition placeholder:text-tp-muted focus:border-tp-purple focus:ring-4 focus:ring-tp-purple/15';
export const card = 'rounded-2xl border border-tp-line bg-white shadow-[0_12px_32px_-18px_rgba(40,30,110,0.25)]';

const KYC_STYLES: Record<KycStatus, { label: string; cls: string; dot: string }> = {
  VERIFIED: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  PENDING: { label: 'Pending KYC', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  REJECTED: { label: 'KYC rejected', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
};

export function KycBadge({ status }: { status: KycStatus }) {
  const s = KYC_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-40 w-40 text-4xl md:h-56 md:w-56 md:text-6xl',
} as const;

const TONES = ['bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700'];

function toneFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** Profile photo when available, otherwise initials on a stable tint. */
export function Avatar({
  name,
  initials,
  photoUrl,
  size = 'md',
  seed,
  className = '',
}: {
  name: string;
  initials: string;
  photoUrl: string | null;
  size?: keyof typeof SIZES;
  seed?: string;
  className?: string;
}) {
  const base = `${SIZES[size]} shrink-0 overflow-hidden rounded-full ${className}`;
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} className={`${base} object-cover ring-2 ring-white`} loading="lazy" />;
  }
  return (
    <div
      aria-label={name}
      className={`${base} flex items-center justify-center font-bold ring-2 ring-white ${toneFor(seed ?? name)}`}
    >
      {initials}
    </div>
  );
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-tp-line bg-tp-lilac text-tp-purpleDark';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}
