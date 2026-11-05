/** Money is always stored in paise. These helpers are the only place we convert for display. */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/** 105000_00 paise -> "₹1,05,000" (Indian grouping) */
export function formatINR(paise: number, opts?: { decimals?: boolean }): string {
  const rupees = paise / 100;
  if (opts?.decimals) {
    return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₹${inr.format(Math.round(rupees))}`;
}

/** Compact form for tiles: 1,05,000 -> "₹1.05L", 1,20,00,000 -> "₹1.2 Cr" */
export function formatINRCompact(paise: number): string {
  const r = paise / 100;
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  return formatINR(paise);
}

export function percent(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((raised / target) * 100));
}

/** Public display name: "Murugan Ramasamy" -> "Murugan R." (never show full identity publicly). */
export function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'HT';
}

export function daysLeft(endsAt: Date | null | undefined, now = new Date()): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');
}

/** Mask a mobile number for display: "9876543210" -> "+91 ******3210" */
export function maskMobile(last4: string): string {
  return `+91 ••••••${last4}`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(d: Date | string, now = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const s = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
