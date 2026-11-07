export const RETURN_WINDOW_DAYS = 7;

/** UTC calendar day used for daily limits, e.g. "2026-11-07". */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
