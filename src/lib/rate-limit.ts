import { errors } from './http';

/**
 * Fixed-window rate limiter.
 * Process-local: suitable for a single instance and development. For multi-instance production
 * (e.g. Vercel), back this with Redis / Upstash using the same key scheme.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    sweep(now);
    return;
  }
  existing.count += 1;
  if (existing.count > limit) throw errors.tooMany();
}

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}
