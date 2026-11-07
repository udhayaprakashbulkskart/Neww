// Route helpers: JSON responses (BigInt-safe), same-origin check, validation, role gates, error mapping.
import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { getConfig } from './config';
import { DomainError } from './errors';
import { currentUser } from './auth';
import { can, type Permission, type StaffRole } from '@/lib/domain/rbac';

export function jsonSafe<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(jsonSafe(data), { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Mutating requests must come from this site (defence in depth on top of SameSite cookies). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const expected = new URL(getConfig().appUrl).origin;
  const requestOrigin = new URL(req.url).origin;
  if (origin !== expected && origin !== requestOrigin) throw new DomainError('CSRF', 'Cross-site request blocked', 403);
}

export async function readJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  assertSameOrigin(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new DomainError('BAD_JSON', 'Request body must be JSON', 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError('VALIDATION', parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), 422);
  }
  return parsed.data;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new DomainError('UNAUTHENTICATED', 'Please sign in', 401);
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role as StaffRole, permission)) throw new DomainError('FORBIDDEN', 'You do not have permission for this action', 403);
  return user;
}

/** Wraps a route handler: maps domain, validation and unexpected errors to safe JSON responses. */
export function handle(fn: () => Promise<Response>) {
  return fn().catch((err: unknown) => {
    if (err instanceof DomainError) return fail(err.code, err.message, err.status);
    if (err instanceof ZodError) return fail('VALIDATION', err.message, 422);
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') return fail('CONFLICT', 'That record already exists', 409);
    if (code === 'P2025') return fail('NOT_FOUND', 'Record not found', 404);
    console.error('[api] unexpected error', err);
    return fail('INTERNAL', 'Something went wrong. Please try again.', 500);
  });
}
