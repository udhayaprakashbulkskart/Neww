/** Browser-side helper for the team portal API. Throws `TeamApiError` with the server's message. */

export class TeamApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function teamApi<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    credentials: 'same-origin',
    cache: 'no-store',
    headers: isForm || init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? (init.body as FormData) : init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let data: { ok?: boolean; data?: T; error?: { message?: string; details?: Record<string, string[]> } } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data?.ok) {
    const details = data?.error?.details ? Object.values(data.error.details).flat().join(' ') : '';
    throw new TeamApiError(
      [data?.error?.message, details].filter(Boolean).join(' ') || 'Something went wrong. Please try again.',
      res.status,
    );
  }
  return data.data as T;
}
