import { requirePermission, handle, fail } from '@/lib/server/http';
import { dateRange } from '@/lib/domain/finance';
import { ENGINE_REPORTS, engineCsv, engineExportTable, type EngineReport } from '@/lib/server/engine-admin';
import { toPrintHtml } from '@/lib/server/finance-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/engine/export?report=pending|volume|refunds|settlements|reconciliation&from=&to=&format=csv|pdf
export async function GET(req: Request) {
  return handle(async () => {
    await requirePermission('engine:read');
    const url = new URL(req.url);
    const report = url.searchParams.get('report') ?? '';
    if (!(ENGINE_REPORTS as readonly string[]).includes(report)) return fail('BAD_REPORT', 'Unknown report', 400);
    const format = url.searchParams.get('format') ?? 'csv';
    if (format !== 'csv' && format !== 'pdf') return fail('BAD_FORMAT', 'Format must be csv or pdf', 400);
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    if (!dateRange(from, to)) return fail('BAD_RANGE', 'Use a valid from and to date', 400);
    const table = await engineExportTable(report as EngineReport, from, to);
    const stamp = `engine-${report}-${from}-to-${to}`;
    if (format === 'csv') {
      return new Response(engineCsv(table), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${stamp}.csv"`, 'Cache-Control': 'no-store' },
      });
    }
    return new Response(toPrintHtml({ title: table.title, headers: table.headers, rows: table.rows }, new Date()), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `inline; filename="${stamp}.html"`, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" },
    });
  });
}
