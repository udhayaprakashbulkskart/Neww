/**
 * Browser-side API client. Every call returns a discriminated result so components can show
 * the server's message without throwing. Sessions are cookie-based; nothing sensitive is stored locally.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; code?: string; status: number };

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {};
    let body: BodyInit | undefined;
    if (init?.form) {
      body = init.form;
    } else if (init?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.body);
    }
    const res = await fetch(path, { method: init?.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'same-origin' });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) return { ok: true, data: json.data as T };
    return {
      ok: false,
      status: res.status,
      code: json?.error?.code,
      message: json?.error?.message ?? 'Something went wrong. Please try again.',
    };
  } catch {
    return { ok: false, status: 0, message: 'No connection. Check your internet and try again.' };
  }
}

/** Convert a rupee input (string or number) to integer paise. Returns NaN for invalid input. */
export function rupeesToPaise(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[,\s₹]/g, ''));
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

export function paiseToRupeeInput(paise: number): string {
  return paise ? String(Math.round(paise / 100)) : '';
}
