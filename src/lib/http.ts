import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { env } from './env';

/** An error that maps directly to an HTTP response. Never leaks internals. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const errors = {
  unauthorized: () => new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue.'),
  forbidden: (message = 'You do not have permission to do this.') => new ApiError(403, 'FORBIDDEN', message),
  notFound: (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} was not found.`),
  conflict: (message: string) => new ApiError(409, 'CONFLICT', message),
  invalidState: (message: string) => new ApiError(422, 'INVALID_STATE', message),
  tooMany: () => new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a few minutes and try again.'),
  badRequest: (message: string, details?: unknown) => new ApiError(400, 'BAD_REQUEST', message, details),
};

export function json<T>(data: T, init?: { status?: number }) {
  return NextResponse.json({ ok: true, data }, { status: init?.status ?? 200 });
}

function failure(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Wrap a route handler: converts thrown ApiError / ZodError into JSON responses and
 * logs unexpected failures without returning stack traces to the client.
 */
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return failure(err.status, err.code, err.message, err.details);
      if (err instanceof ZodError) {
        return failure(400, 'VALIDATION_ERROR', 'Some details are invalid.', err.flatten().fieldErrors);
      }
      console.error('[api] unhandled error', err instanceof Error ? err.message : 'unknown');
      if (!env().isProduction && err instanceof Error) console.error(err.stack);
      return failure(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
    }
  };
}

/** Read a JSON body with a size cap. Returns `{}` for an empty body. */
export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw errors.badRequest('Request body must be valid JSON.');
  }
}

/** Parse and validate a JSON body against a Zod schema. Rejects oversized bodies. */
export async function parseBody<T>(req: Request, schema: ZodType<T>, maxBytes = 64 * 1024): Promise<T> {
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  let raw: unknown;
  try {
    raw = text.length ? JSON.parse(text) : {};
  } catch {
    throw errors.badRequest('Request body must be valid JSON.');
  }
  return schema.parse(raw);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  // The platform proxy appends the connecting address, so the rightmost entry is the trusted one.
  // The leftmost entries are client-supplied and can be forged.
  if (forwarded) return (forwarded.split(',').pop() ?? '').trim().slice(0, 64) || 'unknown';
  return (req.headers.get('x-real-ip') ?? 'unknown').slice(0, 64);
}

/**
 * CSRF defence for state-changing requests: when a browser sends an Origin header it must match
 * our own origin. Combined with SameSite=Lax cookies this blocks cross-site form posts.
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const allowed = new URL(env().NEXT_PUBLIC_APP_URL).origin;
  let host: string | null = null;
  try {
    host = new URL(origin).origin;
  } catch {
    host = null;
  }
  const hostHeader = req.headers.get('host');
  const sameHost = hostHeader ? origin === `https://${hostHeader}` || origin === `http://${hostHeader}` : false;
  if (host !== allowed && !sameHost) throw errors.forbidden('Cross-site request blocked.');
}
