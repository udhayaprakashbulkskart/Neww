// Shared helpers for Spin & Win tests.
export const DAY_MS_FOR_TEST = 86_400_000;
export function dateRange(from: string, to: string) {
  const gte = new Date(`${from}T00:00:00.000Z`);
  const lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000);
  return { gte, lt };
}
