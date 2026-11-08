import { requirePermission, handle, fail } from '@/lib/server/http';
import { dateRange, toCsv, type CsvCell } from '@/lib/domain/finance';
import { spinExportTable, SPIN_REPORTS, type SpinReport } from '@/lib/server/spin-admin';
import { resolveUserId } from '@/lib/server/audit-view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/spin/export?report=spins|distribution|redemptions&from=YYYY-MM-DD&to=YYYY-MM-DD[&user=email-or-id]
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const report = url.searchParams.get('report') ?? '';
    if (!(SPIN_REPORTS as readonly string[]).includes(report)) return fail('BAD_REPORT', 'Unknown report', 400);
    await requirePermission(report === 'redemptions' ? 'spin:redeem' : 'spin:manage');
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const range = dateRange(from, to);
    if (!range) return fail('BAD_RANGE', 'Use a valid from and to date', 400);
    const userParam = url.searchParams.get('user')?.trim() || null;
    const userId = userParam ? await resolveUserId(userParam) : null;
    if (userParam && !userId) return fail('UNKNOWN_USER', 'No member matches that email or id', 404);
    const table = await spinExportTable(report as SpinReport, range, userId);
    const body = '﻿' + toCsv(table.headers, table.rows as CsvCell[][]);
    return new Response(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="spin-${report}-${from}-to-${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
