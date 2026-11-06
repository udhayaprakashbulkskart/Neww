import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './icons';
import { initials } from '@/lib/format';

export function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`pill bg-emerald/15 text-emerald-400 ${className}`}>
      <Icon name="checkCircle" className="h-3.5 w-3.5" strokeWidth={2.4} />
      Verified
    </span>
  );
}

export function ProgressBar({ value, tone = 'mint', label }: { value: number; tone?: 'mint' | 'dark'; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label ?? `${v}% funded`} className="h-2 w-full overflow-hidden rounded-full bg-black/10">
      <div
        className={`progress-grow h-full rounded-full ${tone === 'mint' ? 'bg-gradient-to-r from-emerald-500 to-mint' : 'bg-gradient-to-r from-emerald to-mint-300'}`}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-11 w-11 text-sm';
  return (
    <span className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full border border-mint/20 bg-gradient-to-br from-ink-600 to-ink-800 font-semibold text-mint`}>
      {initials(name)}
    </span>
  );
}

/** Shows a campaign photo, or a calm tinted placeholder when no approved photo exists yet. */
export function CampaignImage({ src, name, className = '' }: { src: string | null; name: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`Campaign photo for ${name}`} loading="lazy" className={`object-cover ${className}`} />;
  }
  // Until an approved photo exists, show an original illustration rather than an empty placeholder.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/illustrations/campaign-default.svg" alt={`Illustration for ${name}'s campaign`} loading="lazy" className={`object-cover ${className}`} />;
}

export function StatusPill({ tone, children }: { tone: 'mint' | 'amber' | 'red' | 'grey' | 'sky'; children: ReactNode }) {
  const map = {
    mint: 'bg-mint/15 text-mint',
    amber: 'bg-ui-warning/15 text-ui-warning',
    red: 'bg-ui-danger/15 text-ui-danger',
    grey: 'bg-white/10 text-ui-muted',
    sky: 'bg-pastel-sky/15 text-pastel-sky',
  } as const;
  return <span className={`pill ${map[tone]}`}>{children}</span>;
}

export function EmptyState({ icon, title, body, action }: { icon: Parameters<typeof Icon>[0]['name']; title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="surface-flat flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/10 text-mint">
        <Icon name={icon} />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-ui-muted">{body}</p>
      {action && (
        <Link href={action.href} className="btn-primary btn-sm mt-5">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ title = 'Something did not load', body = 'Please refresh the page. If this continues, contact support.' }: { title?: string; body?: string }) {
  return (
    <div role="alert" className="surface-flat flex items-start gap-3 border-ui-danger/20 p-5">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-ui-danger" />
      <div>
        <p className="font-semibold text-ui-text">{title}</p>
        <p className="mt-1 text-sm text-ui-muted">{body}</p>
      </div>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  const map = {
    info: 'border-pastel-sky/20 bg-pastel-sky/5 text-pastel-sky',
    success: 'border-mint/20 bg-mint/5 text-mint',
    warning: 'border-ui-warning/25 bg-ui-warning/5 text-ui-warning',
    error: 'border-ui-danger/25 bg-ui-danger/5 text-ui-danger',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${map[tone]}`}>
      {children}
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-28 w-full" />
      ))}
    </div>
  );
}

export function SectionHeader({ title, action, href }: { title: string; action?: string; href?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
      {action && href && (
        <Link href={href} className="text-sm font-medium text-mint hover:text-mint-300">
          {action}
        </Link>
      )}
    </div>
  );
}
